# School conversation form template contract

Reference: original.doc (immutable copy of the supplied 17920-byte legacy Word file). Derived OOXML: template.docx, converted with bundled LibreOffice. Hashes and full package inventory: manifest.json.

One portrait A4 section: 11906 by 16838 twips. Top/bottom margins 1440 twips, left/right margins 1800 twips. No new header, footer, metadata or branding. Preserve all section/page settings and every template part except word/document.xml.

Title: 辅导员心理谈话表. Heading1, centered, bold, 22pt 黑体, 1.5 line spacing. Table body: 10.5pt 宋体 with original 1.5 spacing. Preserve font declarations; PDF font substitution is explicitly reported where these fonts are absent.

Table grid widths: [1427,1258,1469,1313,1254,1668] twips; fixed layout, centered; cell start/end margins 108 twips, top/bottom 0. Black 0.5pt borders. Original row minimum heights [543,518,1094,2198,530] twips. Preserve grid spans, widths, borders, paragraph properties and row rules. No changes to table geometry permitted.

Editable slots in word/document.xml, body/table[0]: row0 cells1/3/5 = name/gender/college; row1 cell1 = grade-major-class; row2 cell0 = show only selected issue numbers and labels, separated by semicolons, appending other text only when option 9 is selected; row3 cell0 paragraphs1..5 = five lines of conversation content, leave paragraph0 label untouched; row4 cell0 final run = append conversation date to original 日期 label. Both signature spaces remain blank for handwriting.

Save incomplete/long drafts in the database. Export requires completed student identity, date and content; reject content that exceeds the five paragraph slots. Render the candidate and original.doc with the same converter/fonts, compare page count, page geometry and every table line segment. Reject exports that move any table border. Preserve-only ZIP entries must be byte-identical. Never shrink text, cut content or silently add a second page.

Per the updated export requirement, replace the issue paragraph with its original field label and only the selected option numbers and labels; remove unselected option text. Preserve the issue row geometry and font. Do not underline selected labels or add checkboxes. No diagnosis or inferred category is created. System timestamps and ownership appear only in the platform.

Conversion correction: express table width as 8389 twips rather than the converter-generated percentage to recover the original DOC table edges; original.doc remains unchanged.

Conversion rounding correction: first grid boundary +2 twips, second column -2 twips, preserving outer width and subsequent boundaries, to recover the original DOC rendered edge at x159.3pt. Derived grid: [1429,1256,1469,1313,1254,1668].

Metadata correction: derived template title set to 辅导员心理谈话表 so the PDF viewer does not display the legacy unrelated metadata title. Page content and original.doc are untouched.

Identity wrapping correction: when a filled first-row identity value exceeds its cell's single-line width, keep the 10.5pt source font and all table geometry, but use a 12pt exact line box inside that filled cell so two complete lines fit its original 27pt row. Short single-line values retain source paragraph spacing. This change is limited to inserted identity text; template labels, table borders and other source paragraphs remain untouched. Longer values that still move a border are rejected with a field-specific message.
