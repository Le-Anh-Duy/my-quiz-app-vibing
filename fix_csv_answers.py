import csv
import os
import glob

bank_dir = r"d:\Coding\side-project\my quiz app\my-quiz-app\public\bank"
csv_files = glob.glob(os.path.join(bank_dir, "*.csv"))

for file_path in csv_files:
    print(f"Processing {file_path}...")
    rows = []
    fieldnames = []
    
    # Read
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            if not fieldnames or "đáp án đúng" not in fieldnames:
                print(f"Skipping {file_path} (invalid header)")
                continue
                
            for row in reader:
                correct_val = row.get("đáp án đúng", "").strip()
                
                # Check if it needs fixing (length > 1 usually means it's the content not the key)
                # Also check if it is not just a single letter a-d
                if len(correct_val) > 1 or correct_val.lower() not in ['a', 'b', 'c', 'd']:
                    found_key = None
                    # Try to find match
                    for key in ['a', 'b', 'c', 'd']:
                        col_name = f"đáp án {key}"
                        if col_name in row and row[col_name].strip() == correct_val:
                            found_key = key
                            break
                    
                    if found_key:
                        row["đáp án đúng"] = found_key
                    else:
                        # Fallback for some fuzzy matching or just leave it
                        # Sometimes csv might have quotes issue, but let's assume content match is exact
                        pass
                
                rows.append(row)
                
        # Write back
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            
        print(f"Finished {file_path}")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
