# Long-term memory

## Objective

Phải luôn suy nghĩ bài toán rộng

Trí nhớ dài hạn cho agent(không chỉ 1 agent mà là cho mỗi agent)

- Đối với mỗi sub-agent:

  - Biết được đang làm gì
  - biết được đã làm gì

- Đối với agent trên phạm vi workspace:

  - đã làm những gì?
  - những sai sót trong quá khứ
  - có những decision quan trọng nào đã được make mà cần respect?
  - kinh nghiệm -> `CAS`/`APM` sẽ phải cung cấp cách để Agent tạo và tự lưu được skill (kinh nghiệm) mới (skill thì tổ chức theo: workspace)

## Ideas

> Vì đang còn rất nhiều mảnh ghép nên dưới đây là những idea vụn vặt chưa phân loại, sẽ tổ chức lại khi mường tượng được một bức tranh cụ thể

- Layer 1: Hot Memory (auto-loaded, always available)
Phần này sẽ để trong `agent/rules/common/hot-memory` và dùng symlink để tạo cho cursor, codex, antigravity...

- Layer 2: Warm Memory (loaded on demand)

- Layer 3: Cold Memory (transcripts, searchable khi cần)

### API/Achitecture
