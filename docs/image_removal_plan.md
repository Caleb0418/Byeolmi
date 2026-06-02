# 품목 이미지 삭제 및 UI 간소화 계획서

사장님의 요청에 따라, **구매자용 모바일 화면 및 사장님용 품목 추가/편집 모달 전체에서 이미지(사진) 관련 요소를 완전히 제거**하고, 텍스트와 텍스트형 상태 게이지바 중심의 정갈한 미니멀 디자인으로 레이아웃을 환원하기 위한 작업 계획입니다.

---

## 1. 주요 제거 대상

1. **구매자용 화면 (`client.html`)**:
   * 게이지바 품목 리스트 내의 대표 썸네일 이미지 박스 (`<img>` 및 감싸고 있는 `div`) 삭제.
   * 이미지가 없어짐에 따라 텍스트 정보가 가로폭 전체를 채워 가독성을 확보하도록 레이아웃 재배치.
2. **공급자용 관리 대시보드 (`index.html`)**:
   * 품목 등록/수정 모달의 **"상품 이미지 주소"** 입력 필드 (`input` 및 라벨) 제거.
   * `loadProductToEditor` 및 `submit` 자바스크립트 폼 핸들러 내의 이미지 변수 매핑 코드 제거.
3. **데이터 소스 및 에셋**:
   * `app.js` 내 품목 초기화 데이터 및 구조체에서 `image` 프로퍼티 삭제.

---

## 2. 세부 변경 파일
* **[MODIFY] [app.js](file:///c:/Users/seung/Desktop/유승종/11_BongBong/app.js)**: 품목 객체에서 `image: "fresh_vegetables.png"` 프로퍼티 전체 삭제.
* **[MODIFY] [index.html](file:///c:/Users/seung/Desktop/유승종/11_BongBong/index.html)**: 이미지 입력 필드 마크업과 스크립트 바인딩 제거.
* **[MODIFY] [client.html](file:///c:/Users/seung/Desktop/유승종/11_BongBong/client.html)**: 모바일 카드 내 이미지 프레임 제거 및 텍스트 레이아웃 확장.
