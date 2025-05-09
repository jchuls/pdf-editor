
# 📄 PDF Editor

🖋️ PDF에 선 그리기, 글쓰기, Undo, 삭제, 드래그 이동, 저장, 불러오기 기능을 지원하는 JS 기반 PDF 에디터입니다.

## ✨ 기능

- PDF 뷰어 & 편집기
- 선 그리기 (형광펜/일반 선 선택)
- 글쓰기 (사용자 입력)
- Undo (Ctrl+Z)
- Delete (선택 후 Delete 키)
- 드래그 이동 (오른쪽 클릭 + 드래그)
- 프린트 및 다운로드
- 서버에 저장 & 불러오기 (DB)

---

## 🚀 실행 방법

> ❗ **중요:** PDF.js는 보안을 위해 `file://`로 직접 열 수 없습니다. 반드시 웹서버 환경에서 실행해야 합니다.

### 1️⃣ Node.js가 있다면:

```bash
npx serve
# 또는
npx http-server
```
→ 브라우저에서 `http://localhost:5000` (또는 안내된 포트) 접속

---

### 2️⃣ Python이 있다면:

```bash
# Python 3.x
python -m http.server 8000
```
→ 브라우저에서 `http://localhost:8000` 접속

---

## 📂 파일 구조 예시

```
pdf-editor/
├── dist/
│   └── pdfEditor.js
├── php/
│   ├── get_draw_data.php
│   └── save_draw_data.php
├── sample-pdf/
│   └── sample.pdf
├── index.html
└── README.md
```

---

## 💻 사용 예제

HTML:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<div id="pdf-editor-menu"></div>
<div id="pdf-editor-container"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="./dist/pdfEditor.js"></script>

<script>
pdfEditor.loadAndEnablePdfEditor({
    pdfUrl: './sample-pdf/sample.pdf?real_file=sample',
    containerId: 'pdf-editor-container',
    menuId: 'pdf-editor-menu',
    fileIdParam: 'real_file'
});
</script>
```

불러오기:

```js
pdfEditor.loadFromServer('sample'); // real_file 파라미터 기준
```

---

## 📦 데이터베이스 세팅

아래 SQL을 실행해서 `pdf_drawings` 테이블을 생성하세요:

```sql
CREATE TABLE `pdf_drawings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `pdf_id` VARCHAR(255) NOT NULL,
    `page` INT NOT NULL,
    `actions` JSON NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

✔️ **pdf_id**는 `real_file` 등 PDF의 식별자입니다.  
✔️ **actions**에는 각 페이지의 드로잉 데이터가 JSON으로 저장됩니다.

---

## ⚠️ PHP 백엔드 참고

`php/save_draw_data.php` 예제:

```php
<?php
$mysqli = new mysqli('localhost', 'username', 'password', 'database');
if ($mysqli->connect_errno) {
    echo json_encode(['success' => false, 'message' => 'DB 연결 실패']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['pdfId'])) {
    echo json_encode(['success' => false, 'message' => '잘못된 요청']);
    exit;
}

$pdfId = $mysqli->real_escape_string($data['pdfId']);

foreach ($data['pages'] as $pageData) {
    $page = intval($pageData['page']);
    $actions = $mysqli->real_escape_string(json_encode($pageData['actions']));

    $existing = $mysqli->query("SELECT id FROM pdf_drawings WHERE pdf_id = '$pdfId' AND page = $page");
    if ($existing->num_rows > 0) {
        $mysqli->query("UPDATE pdf_drawings SET actions = '$actions' WHERE pdf_id = '$pdfId' AND page = $page");
    } else {
        $mysqli->query("INSERT INTO pdf_drawings (pdf_id, page, actions) VALUES ('$pdfId', $page, '$actions')");
    }
}

echo json_encode(['success' => true]);
?>
```

👉 DB 접속 정보는 본인 환경에 맞게 수정하세요.

---

## 🔎 디버그 팁

- PDF 파일이 안 뜰 때:
    - `pdfUrl` 경로 재확인 (index.html 기준 상대경로)
    - 크롬 개발자도구 → Network 탭에서 상태코드 확인
    - PHP로 출력 시 `Content-Type: application/pdf` 헤더 체크
- `UnknownErrorException` → **file://로 열었거나 CORS 문제**

---

✅ 이상입니다! 바로 클론해서 테스트할 수 있도록 구성했습니다 🙌
