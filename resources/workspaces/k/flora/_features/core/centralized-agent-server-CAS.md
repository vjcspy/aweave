# Centralized agent server



Trước chúng ta đã build 1 con git relay frontend and git relay server nhưng nó quá specific và để sửa thì phải change khá nhiều vì achitecture không support general.



## Idea

### Data tranfer

- Hỗ trợ api plain data, tức là cả client và server giao tiếp với nhau không cần encrypt data, trả về public data như skill, rule, prompt, resource...

- Hỗ trợ encrypt data, tức là client và server giao tiếp với nhau dùng mã hóa bất đối xứng(tìm thuật toán nhẹ)

  - mỗi client sẽ có 1 id, nó sẽ register với server để gửi cho server public key của nó
  - server thì có public key và được include vào trong source code luôn.
  - Chỉ cần 1 api general: `/api/game/action` thì client sẽ gửi data kiểu(tất nhiên body này sẽ bị encrypted)

  ```json
  {
    "action": "ACTION_NAME"
    "payload": {}
  }
  ```

  

### Long term memory

Mục đích chính của con server này là nơi centralized toàn bộ data của agent.

- long-term memory