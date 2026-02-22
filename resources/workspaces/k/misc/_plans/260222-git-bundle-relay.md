# 📋 [GIT-BUNDLE-RELAY: 2026-02-22] - Strict Git Commit Sync via Bundle

## 🎯 Objective

Thay thế cơ chế đồng bộ code sử dụng `git format-patch` bằng **Git Bundle** (`git bundle`). Giải pháp này giúp đóng gói toàn bộ các git objects (commits, trees, blobs) thành một khối thống nhất, đảm bảo giữ nguyên 100% lịch sử Git (bao gồm mã SHA của commit, author, committer, date và message) khi chuyển code từ mạng private ra ngoài external GitHub.

## 📝 Yêu cầu hệ thống (System Requirements)

1. **Sync Master to Master (Mặc định)**: User code trên branch `master` ở local và muốn sync lên đúng `master` của external repo.
2. **Khả năng mở rộng**: CLI truyền tên repo (`--repo`) và branch (`--branch`) linh hoạt, server không hardcode branch.
3. **Cơ chế chống Diverge (Divergence Prevention)**: Hệ thống phải tự động biết last commit trên external repo, nếu local (private) chưa có commit này, CLI phải từ chối ngay lập tức và yêu cầu user phải pull/sync branch từ external dể hoà trộn (merge) trước khi làm việc tiếp.
4. **Không chạy quá giới hạn Transport**: Dù dùng bundle thì bundle size sau khi encrypt và base64 vẫn phải cắt nhỏ thành các chunk dưới 4.5MB để pass qua Vercel.

---

## 🏗 Architecture & Workflow Hiện tại vs. Mới

### Khác biệt chính

- **Cũ (Patch)**: `git format-patch` -> gửi dạng text/binary -> server dùng `git am`. Sinh ra commit SHA mới.
- **Mới (Bundle)**: Hỏi server lấy External Last SHA -> `git bundle create` -> server dùng `git fetch /tmp/bundle`. Giữ nguyên SHA.

### Luồng xử lý chi tiết (The Flow)

1. **Pre-flight Check (Lấy thông tin Remote):**
   - User chạy `aw relay push --repo owner/repo --branch master`. (Branch cấu hình được, mặc định `master`).
   - CLI gọi `GET /api/game/remote-info?repo=owner/repo&branch=master` (qua Vercel tới Server).
   - Server lấy thông tin bằng `git ls-remote https://<PAT>@github.com/owner/repo.git refs/heads/master`. Trả về `remote-sha` (hoặc chuỗi rỗng nếu branch chưa tồn tại trên remote).

2. **Validation (Trong Private Network):**
   - Thay vì chỉ check object (dễ lỗi khi diverge), CLI dùng ancestry check:
     - Nếu `remote-sha` rỗng (first push nhánh mới): Bỏ qua check ancestry, tạo bundle cho base branch hoặc toàn bộ (ví dụ: `git bundle create relay.bundle HEAD`).
     - Nếu có `remote-sha`:
       - Chạy `git cat-file -t <remote-sha>` để check tồn tại.
       - Chạy `git merge-base --is-ancestor <remote-sha> HEAD` để chống diverge.
       - Nếu fail bất kì điều kiện nào: Báo lỗi `[ERR_OUT_OF_SYNC]: Branch bị diverge hoặc local của bạn bị cũ. Yêu cầu update/pull từ external repo về private network trước.`
       - Nếu pass: Xác định dải commit (ví dụ `<remote-sha>..<local-branch-HEAD>`). Nếu `remote-sha == HEAD`, báo đã up-to-date.

3. **Gói dữ liệu (Bundle Creation):**
   - CLI chạy lệnh: `git bundle create relay.bundle <remote-sha>..HEAD` (hoặc cấu trúc lệnh tương đương cho first push).
   - Bundle sẽ chứa file nhị phân lưu chính xác các commit mới.

4. **Transport (Giữ nguyên kiến trúc Chunking):**
   - CLI đọc file `relay.bundle`, mã hoá (AES-256-GCM), chia chunk (mỗi chunk 3MB).
   - CLI gửi các chunk qua `POST /api/game/chunk`.
   - Gửi tín hiệu hoàn tất qua `POST /api/game/chunk/complete`.

5. **Server Áp dụng (Server Application):**
   - Vercel gọi Server để tiến hành xử lý bất đồng bộ. (Trạng thái hiển thị cập nhật sang "Processing bundle").
   - Server reassemble các chunks, giải mã (Decrypt) lại thành file `/tmp/<session-id>/relay.bundle`.
   - Tại thư mục repo clone:
     - Chạy `git bundle verify /tmp/<session-id>/relay.bundle` để validate file bundle và ghi nhận lỗi nếu fail.
     - Dùng cơ chế fetch vào temp ref để tránh conflict với working tree checkout của server repo:

       ```bash
       git fetch /tmp/<session-id>/relay.bundle <branch>:refs/relay/<session-id>
       git push origin refs/relay/<session-id>:refs/heads/<branch>
       # (Có thể tuỳ chọn dọn dẹp temp ref: git update-ref -d refs/relay/<session-id>)
       ```

---

## ⚙️ Các Module Cần Sửa

### 1. `git-relay-server` (Backend Node.js tại `workspaces/k/misc/git-relay-server/`)

- Thêm Route mới trong `src/routes/gr.ts` để nó được mount tự động vào prefix `/api/gr`:
  `GET /remote-info?repo=owner/repo&branch=master` (Endpoint công khai: `/api/gr/remote-info`)
- Cập nhật hàm `getRemoteInfo(repo, branch)` trong `services/git.ts`:

  ```typescript
  // Dùng git ls-remote thay vì phải tốn công clone repo nếu chưa có!
  const out = await git.env({ ... }).raw(['ls-remote', remoteUrl, `refs/heads/${branch}`]);
  // parse the SHA from output
  ```

- Sửa đổi hook xử lý apply tại `src/routes/gr.ts` và `src/services/git.ts`:
  - Cập nhật status string `Processing patch` -> `Processing bundle`.
  - Thay thế bước `applyPatch` bằng `applyBundle`: chạy `git bundle verify`, fetch vào tham chiếu tạm thời `refs/relay/...` và push trực tiếp ref đó lên `origin`. (Thay đổi RepoManager support fetching bare ref tracking).

### 2. `git-relay-vercel` (Stateless Vercel Proxy tại `workspaces/k/misc/git-relay-vercel/`)

- Bổ sung Route Proxy mới: `src/app/api/game/remote-info/route.ts` để forward raw Header qua server Node.
- Ưu tiên cập nhật hàm proxy `forwardToServer()` trong `src/lib/forward.ts` để đảm bảo chuỗi truy vấn (query params) như `?repo=...&branch=...` được mang sang đúng SERVER_URL.

### 3. `@aweave/cli-plugin-relay` (CLI App tại `workspaces/devtools/common/cli-plugin-relay/`)

- Update code trong thư mục lệnh `push`: `src/commands/relay/push.ts`
- Implement phần *Pre-flight check* (thay vì buộc user pass `commit_id` như bản nháp cũ, giờ hệ thống tự lấy `remote-sha` => UI UX tốt hơn nhiều, không bắt user gõ mã hash bằng tay).
- Chạy `git bundle create` (lưu vào file temp hoặc stdout stream) thay vì `git format-patch`. Bổ sung ancestry check và xử lý trường hợp first push missing remote-sha.

---

## 🚀 Tính năng mở rộng & Linh hoạt (Extensibility)

Để đáp ứng được việc bạn muốn có thể define branch hoặc repo khác:
Mặc định CLI sẽ tự động map:

- Git repo local: Lấy origin url (nếu parse được) hoặc config lưu bằng `aw relay config set --repo owner/my-repo`.
- Branch: Tự đọc local `git branch --show-current`. Nếu đang ở `master`, tự sync lên `master`.

Ví dụ thao tác của người dùng sẽ dễ như thế này:

```bash
$ git checkout master
$ git commit -m "update code"
$ aw relay push
# CLI tự hiểu: repo = owner/my-repo, branch = master
# CLI tự hỏi server xem master bên kia tới đâu rồi
# CLI tự bundle tạo phần khác biệt -> Gửi -> Done.
```

Kể cả khi muốn đẩy branch khác (ví dụ: `hotfix-1`):

```bash
git checkout hotfix-1
aw relay push --repo my-org/my-repo --branch hotfix-1
```

Hệ thống hoàn toàn là "data agnostic" với tên branch, đáp ứng mọi kịch bản.

---
**Plan Status**: Ready for Implementation.
Vui lòng kiểm tra plan trên, nếu không còn vướng mắc gì, chúng ta có thể chuyển sang chế độ EXECUTION.

## Implementation Notes / As Implemented

- **`git-relay-server`**: Implemented `GET /api/gr/remote-info` to query GitHub viat `git ls-remote`. Replaced patching logic in `processSession` with `applyBundle`, which downloads the bundle, verifies it, fetches it into `refs/relay/<session_id>`, and directly pushes to origin branch. Removed `pushBranch`.
- **`git-relay-vercel`**: Added `src/app/api/game/remote-info/route.ts` to proxy requests and pass along query parameters (`?repo=...&branch=...`) transparently using `req.nextUrl.search`.
- **`cli-plugin-relay`**: Updated `aw relay push` to detect the remote origin repo automatically if omitted. `commit` and `commits` flags have been removed. The CLI now queries the remote SHA safely, generates a `HEAD` bundle if nonexistent, or runs `git merge-base --is-ancestor` and then generates the bundle dynamically preventing divergence. Replaced `git format-patch` with `git bundle create`.
