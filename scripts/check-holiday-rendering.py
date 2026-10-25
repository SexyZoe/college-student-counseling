"""Check real PDF output: repeated headers and screenshots inside their own cells."""
import sys,re
from pathlib import Path
import pdfplumber
root=Path(sys.argv[1])
for name in ['single','eight-days','no-images','original','long-list']:
    with pdfplumber.open(root/(name+'.pdf')) as pdf:
        if name=='long-list':
            assert len(pdf.pages)>=2, 'Large list must paginate'
        for page in pdf.pages:
            words=page.extract_words()
            text=page.extract_text()
            verticals=[line for line in page.lines if abs(line['x0']-line['x1'])<.1 and abs(line['y1']-line['y0'])>10]
            xs=sorted(set(round(line['x0'],2) for line in verticals))
            assert len(xs)>=16,(name,'Missing table borders')
            ys=sorted(set(round(line['top'],2) for line in page.lines if abs(line['top']-line['bottom'])<.1 and line['width']>10))
            header_bottom=min(y for y in ys if y>ys[0]+1)
            header=page.crop((xs[10],max(0,ys[0]-1),xs[11],header_bottom+.2)).extract_text()
            assert '与父母报备情况' in re.sub(r'\s+','',header), (name,'Repeated header missing')
            assert '确认截图' in re.sub(r'\s+','',header), (name,'Long header truncated',header)
            for image in page.images:
                assert xs[10]-.1<=image['x0']<image['x1']<=xs[11]+.1,(name,'Screenshot outside reporting column')
                assert abs(image['width']/image['height']-640/420)<.005,(name,'Screenshot stretched')
                top=max(y for y in ys if y<=image['top']+.1)
                bottom=min(y for y in ys if y>=image['bottom']-.1)
                assert not any(top+.2<y<bottom-.2 for y in ys),(name,'Screenshot crosses a row border')
                report=[w for w in words if w['x0']>=xs[10]-.1 and w['x1']<=xs[11]+.1 and top<=w['top']<bottom]
                assert all(w['bottom']<image['top']+.1 for w in report),(name,'Screenshot covers reporting text')
                assert 0<=image['top']<image['bottom']<=page.height,(name,'Screenshot clipped at page boundary')
        print(f'PASS: {name}, {len(pdf.pages)} page(s), full headers and screenshot bounds/aspect/text verified')
