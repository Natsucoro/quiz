
import json
import os
import glob

def count_quizzes():
    data_dir = "/wsl.localhost/Ubuntu/home/nakahara/workspace/quiz/data/quizzes/*.json"
    files = glob.glob(data_dir)
    
    results = {}
    
    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                for item in data:
                    genre = item.get('genre', 'Unknown')
                    diff = item.get('difficulty', 0)
                    
                    if genre not in results:
                        results[genre] = {}
                    
                    results[genre][diff] = results[genre].get(diff, 0) + 1
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                
    # Sort genres
    sorted_genres = sorted(results.keys())
    
    print("| ジャンル | " + " | ".join([f"Lv.{i}" for i in range(1, 11)]) + " | 合計 |")
    print("| :--- | " + " | ".join([":---:" for _ in range(1, 12)]) + " |")
    
    for genre in sorted_genres:
        counts = results[genre]
        line = [f"**{genre}**"]
        total = 0
        for i in range(1, 11):
            c = counts.get(i, 0)
            line.append(str(c) if c > 0 else "-")
            total += c
        line.append(f"**{total}**")
        print("| " + " | ".join(line) + " |")

if __name__ == "__main__":
    count_quizzes()
