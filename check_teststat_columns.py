import csv

# Check what columns are actually in TestStat.csv
with open('TestStat.csv', encoding='utf-8') as f:
    # Find the header line
    lines = f.readlines()
    header_line_idx = 0
    for i, line in enumerate(lines):
        if line.startswith(',Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,'):
            header_line_idx = i
            break

    # Reset and read from header
    f.seek(0)
    reader = csv.DictReader(f)
    # Skip metadata lines
    for _ in range(header_line_idx):
        next(reader, None)

    # Get the first data row to see column values
    first_row = next(reader, None)
    if first_row:
        print("Columns in TestStat.csv:")
        for col in first_row.keys():
            print(f"  {col}: '{first_row[col]}'")

        print("\nFirst row data:")
        for col, val in first_row.items():
            if val:  # Only show non-empty values
                print(f"  {col}: {val}")
    else:
        print("No data rows found")