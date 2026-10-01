"""
howstat-import.py: converts the owner's HowSTAT Excel exports into the CSVs that
scripts/cricsheet/howstat-check.mjs and the build read.

  input   <folder>/ODI/*.xlsx and <folder>/T20I/*.xlsx   (one sheet each, headers as on the site)
  output  data-raw/howstat/<format>-<nation>.csv

No extra libraries: an .xlsx is a zip of XML. Values are copied as they are; nothing is changed.
Usage: python scripts/cricsheet/howstat-import.py "C:/Users/shiva/Downloads/Player CSV"
"""
import csv, os, re, sys, zipfile
from xml.etree import ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
NATIONS = ['Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'New Zealand', 'Pakistan',
           'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe']


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    sheet = sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', n))[0]
    rows = []
    for row in ET.fromstring(z.read(sheet)).iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            v = c.find('m:v', NS)
            t = c.get('t')
            if t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
            elif v is None:
                val = ''
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text
            cells[col_index(c.get('r'))] = val
        if cells:
            rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
    return rows


def nation_of(filename):
    name = filename.replace('Indian', 'India')
    for n in sorted(NATIONS, key=len, reverse=True):
        if name.replace(' ', '').lower().startswith(n.replace(' ', '').lower()):
            return n
    return None


def main(folder):
    out_dir = os.path.join('data-raw', 'howstat')
    os.makedirs(out_dir, exist_ok=True)
    for fmt_dir, fmt in (('ODI', 'odi'), ('T20I', 't20i')):
        d = os.path.join(folder, fmt_dir)
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith('.xlsx'):
                continue
            nation = nation_of(f)
            if not nation:
                print('skipped (nation not recognised):', f)
                continue
            rows = read_xlsx(os.path.join(d, f))
            out = os.path.join(out_dir, f"{fmt}-{nation.lower().replace(' ', '-')}.csv")
            with open(out, 'w', newline='', encoding='utf-8') as fh:
                csv.writer(fh).writerows(rows)
            print(f'{out}: {len(rows) - 1} rows | header: {rows[0]}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
