# PDF Editor

🖋️ PDF에 선 긋기, 글쓰기, Undo, 삭제, 드래그 이동, 저장, 불러오기 기능을 지원하는 JS 기반 PDF 에디터입니다.

## 사용 방법

### 1️⃣ 설치

- `/dist/pdfEditor.js`를 웹 프로젝트에 포함
- `/php/`의 PHP 파일들을 서버에 복사 (DB 연동 필요)

### 2️⃣ HTML

```
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<div id="pdf-editor-menu"></div>
<div id="pdf-editor-container"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="./dist/pdfEditor.js"></script>
```

### 3️⃣ 초기화

```
pdfEditor.loadAndEnablePdfEditor({
    pdfUrl: 'https://example.com/file_view.php?file_link=...&real_file=6001038028.pdf',
    containerId: 'pdf-editor-container',
    menuId: 'pdf-editor-menu',
    fileIdParam: 'real_file'  // 기본값 (필요시 변경 가능)
});
```

### 4️⃣ 불러오기

```
pdfEditor.loadFromServer('6001038028');
```

---
