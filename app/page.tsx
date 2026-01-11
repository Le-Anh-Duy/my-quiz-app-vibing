"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";

// --- CÁC KIỂU DỮ LIỆU ---

interface Question {
  "câu hỏi": string;
  "đáp án a": string;
  "đáp án b": string;
  "đáp án c": string;
  "đáp án d": string;
  "đáp án đúng": string;
}

interface Bai {
  id: string;
  name: string;
  file: string;
  questionCount?: number;
}

interface Settings {
  mode: "instant" | "exam";
  limit: number;
  shuffle: boolean;
  cleanQuestion: boolean; // Tùy chọn mới: Xóa "Câu X."
  selectedBai: string; // ID bài được chọn
}

type GameState = "loading" | "selecting" | "menu" | "playing" | "result";

interface UserHistory {
  questionIndex: number;
  selectedKey: string;
  isCorrect: boolean;
}

// --- HÀM TIỆN ÍCH ---

const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Hàm xóa "Câu XX." ở đầu văn bản
const cleanText = (text: string) => {
  // Regex tìm: Bắt đầu bằng chữ "Câu", khoảng trắng, số, dấu chấm hoặc hai chấm
  return text.replace(/^(Câu|câu)\s+\d+[:.]\s*/, "").trim();
};

export default function Home() {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [availableBai, setAvailableBai] = useState<Bai[]>([]);
  
  // Cấu hình mặc định
  const [settings, setSettings] = useState<Settings>({
    mode: "instant",
    limit: 10,
    shuffle: true,
    cleanQuestion: true, // Mặc định bật chế độ làm sạch
    selectedBai: "", // Sẽ được set khi load xong
  });

  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<UserHistory[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false); // Hiển thị đáp án đúng

  // 1. Load danh sách các bài từ manifest.json
  useEffect(() => {
    fetch("/bank/manifest.json")
      .then((res) => res.json())
      .then((baiList: Bai[]) => {
        setAvailableBai(baiList);
        setSettings(prev => ({ ...prev, selectedBai: baiList[0]?.id || "" }));
        setGameState("selecting");
      })
      .catch((err) => {
        console.error("Không thể load danh sách bài:", err);
        alert("Lỗi khi tải danh sách bài học!");
      });
  }, []);

  // 2. Load file CSV khi chọn bài
  const loadBai = (baiId: string) => {
    const bai = availableBai.find(b => b.id === baiId);
    if (!bai) return;

    setGameState("loading");
    fetch(bai.file)
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result: any) => {
            const validData = result.data.filter((q: any) => q["câu hỏi"]);
            setAllQuestions(validData);
            setSettings(prev => ({ ...prev, limit: validData.length, selectedBai: baiId }));
            setGameState("menu");
          },
        });
      })
      .catch(() => {
        alert("Không thể tải bài học. Vui lòng thử lại!");
        setGameState("selecting");
      });
  };

  // 3. Bắt đầu game
  const startGame = () => {
    let questionsToPlay = [...allQuestions];

    if (settings.shuffle) {
      questionsToPlay = shuffleArray(questionsToPlay);
    }

    if (settings.limit > 0 && settings.limit < questionsToPlay.length) {
      questionsToPlay = questionsToPlay.slice(0, settings.limit);
    }

    setCurrentQuestions(questionsToPlay);
    setCurrentQIndex(0);
    setScore(0);
    setHistory([]);
    setIsChecking(false);
    setSelectedTemp(null);
    setShowExplanation(false); // Reset
    setGameState("playing");
  };

  // 4. Xử lý đáp án
  const handleAnswer = (key: string) => {
    if (isChecking) return;

    const currentQ = currentQuestions[currentQIndex];
    const correctKey = currentQ["đáp án đúng"]?.trim().toLowerCase();
    const isCorrect = key === correctKey;

    const newHistory = [...history, { questionIndex: currentQIndex, selectedKey: key, isCorrect }];
    setHistory(newHistory);

    if (isCorrect) setScore((s) => s + 1);

    if (settings.mode === "instant") {
      setSelectedTemp(key);
      setIsChecking(true);
      // Không tự động chuyển câu nữa, để user tự click "Tiếp theo"
    } else {
      goToNextQuestion();
    }
  };

  // Hàm chuyển sang câu tiếp theo (cho chế độ instant)
  const handleNextQuestion = () => {
    goToNextQuestion();
    setIsChecking(false);
    setSelectedTemp(null);
    setShowExplanation(false); // Reset trạng thái hiển thị giải thích
  };

  const goToNextQuestion = () => {
    if (currentQIndex < currentQuestions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else {
      setGameState("result");
    }
  };

  // Hàm render nội dung câu hỏi (có xử lý làm sạch)
  const renderQuestionText = (text: string) => {
    return settings.cleanQuestion ? cleanText(text) : text;
  };

  // --- UI ---

  if (gameState === "loading") {
    return <div className="flex h-screen items-center justify-center text-xl text-gray-600 font-medium">Đang tải dữ liệu...</div>;
  }

  // UI: SELECTING - Chọn bài học
  if (gameState === "selecting") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-blue-600 mb-2">Trắc Nghiệm Y Khoa</h1>
            <p className="text-gray-500">Chọn bài học để bắt đầu luyện tập</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableBai.map((bai) => (
              <button
                key={bai.id}
                onClick={() => loadBai(bai.id)}
                className="group relative rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl group-hover:bg-blue-500 transition-colors">
                    📚
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {bai.name}
                    </h3>
                    <p className="text-sm text-gray-500">Nhấn để chọn</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // UI: MENU
  if (gameState === "menu") {
    const currentBai = availableBai.find(b => b.id === settings.selectedBai);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl border border-gray-100">
          <div className="mb-6">
            <h1 className="text-center text-3xl font-extrabold text-blue-600 tracking-tight">Trắc Nghiệm Y Khoa</h1>
            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
                📚 {currentBai?.name || "Đang chọn..."}
              </span>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Mode */}
            <div>
              <label className="mb-2 block font-semibold text-gray-700">Chế độ chơi:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, mode: "instant" })}
                  className={`rounded-lg p-3 border transition text-sm font-bold ${settings.mode === "instant" ? "bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}
                >
                  ⚡ Luyện tập
                </button>
                <button
                  onClick={() => setSettings({ ...settings, mode: "exam" })}
                  className={`rounded-lg p-3 border transition text-sm font-bold ${settings.mode === "exam" ? "bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}
                >
                  📝 Đi thi
                </button>
              </div>
            </div>

            {/* Slider */}
            <div>
              <div className="flex justify-between mb-2">
                 <label className="font-semibold text-gray-700">Số lượng câu:</label>
                 <span className="font-bold text-blue-600">{settings.limit} câu</span>
              </div>
              <input
                type="range"
                min="1"
                max={allQuestions.length}
                value={settings.limit}
                onChange={(e) => setSettings({ ...settings, limit: Number(e.target.value) })}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
              />
              <div className="text-right text-xs text-gray-400 mt-1">Tổng kho: {allQuestions.length} câu</div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer rounded-lg border p-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">🔀 Xáo trộn câu hỏi</span>
                    <input
                        type="checkbox"
                        checked={settings.shuffle}
                        onChange={(e) => setSettings({ ...settings, shuffle: e.target.checked })}
                        className="h-5 w-5 accent-blue-600"
                    />
                </label>

                <label className="flex items-center justify-between cursor-pointer rounded-lg border p-3 hover:bg-gray-50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">✂️ Ẩn số thứ tự gốc</span>
                        <span className="text-[10px] text-gray-400">Ví dụ: "Câu 19. abc" thành "abc"</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings.cleanQuestion}
                        onChange={(e) => setSettings({ ...settings, cleanQuestion: e.target.checked })}
                        className="h-5 w-5 accent-blue-600"
                    />
                </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setGameState("selecting")}
                className="rounded-xl bg-gray-100 px-6 py-4 text-sm font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                ← Chọn bài khác
              </button>
              <button
                onClick={startGame}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-lg font-bold text-white shadow-lg transition transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
              >
                Vào thi ngay
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // UI: PLAYING
  if (gameState === "playing") {
    const q = currentQuestions[currentQIndex];
    const correctKey = q["đáp án đúng"]?.trim().toLowerCase();

    // Tính phần trăm tiến độ
    const progress = ((currentQIndex) / currentQuestions.length) * 100;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Progress Bar */}
          <div className="h-2 w-full bg-gray-200">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Câu hỏi {currentQIndex + 1}/{currentQuestions.length}
              </span>
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1">
                <span className="text-sm font-bold text-blue-700">Điểm: {score}</span>
              </div>
            </div>

            {/* Câu hỏi */}
            <h2 className="mb-8 text-xl font-bold leading-relaxed text-gray-800 md:text-2xl">
              {renderQuestionText(q["câu hỏi"])}
            </h2>

            {/* Các đáp án */}
            <div className="flex flex-col gap-3">
              {[
                { key: "a", content: q["đáp án a"] },
                { key: "b", content: q["đáp án b"] },
                { key: "c", content: q["đáp án c"] },
                { key: "d", content: q["đáp án d"] },
              ].map((option) => {
                let btnClass = "border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700";
                
                if (settings.mode === "instant" && isChecking) {
                  // Logic mới: Chỉ hiện màu xanh (đúng) nếu đã bấm "Xem đáp án" HOẶC người dùng đã chọn đúng
                  const shouldRevealCorrect = showExplanation || selectedTemp === correctKey;

                  if (option.key === correctKey) {
                    if (shouldRevealCorrect) {
                       btnClass = "bg-green-100 border-green-500 text-green-800 font-bold ring-1 ring-green-500";
                    } else {
                       // Nếu chưa muốn reveal thì làm mờ đi như các câu khác
                       btnClass = "opacity-40 border-gray-100";
                    }
                  } else if (option.key === selectedTemp) {
                    btnClass = "bg-red-100 border-red-500 text-red-800 font-medium";
                  } else {
                    btnClass = "opacity-40 border-gray-100";
                  }
                }

                return (
                  <button
                    key={option.key}
                    disabled={isChecking}
                    onClick={() => handleAnswer(option.key)}
                    className={`group relative flex items-start rounded-lg border-2 p-4 text-left transition-all active:scale-[0.98] ${btnClass}`}
                  >
                    <span className={`mr-4 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold uppercase ${
                       settings.mode === "instant" && isChecking && option.key === correctKey && (showExplanation || selectedTemp === correctKey)
                       ? "bg-green-500 text-white border-green-500" 
                       : settings.mode === "instant" && isChecking && option.key === selectedTemp
                       ? "bg-red-500 text-white border-red-500"
                       : "bg-gray-50 text-gray-500 border-gray-200 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-colors"
                    }`}>
                      {option.key}
                    </span>
                    <span className="text-base">{option.content}</span>
                  </button>
                );
              })}
            </div>

            {/* Hiển thị giải thích và nút tiếp theo (chế độ luyện tập) */}
            {settings.mode === "instant" && isChecking && (
              <div className="mt-6 space-y-4">
                {/* Giải thích - chỉ hiện khi bấm xem */}
                {showExplanation && (
                  <div className={`rounded-lg border-2 p-4 ${selectedTemp === correctKey ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    <div className="space-y-3">
                      {selectedTemp !== correctKey && (
                        <div className="flex items-start gap-2">
                          <span className="text-red-600 font-bold text-sm">❌ Bạn đã chọn:</span>
                          <span className="text-red-700 font-medium">{selectedTemp?.toUpperCase()}. {q[`đáp án ${selectedTemp}` as keyof Question]}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="text-green-700 font-bold text-sm">✅ Đáp án đúng:</span>
                        <span className="text-green-800 font-medium">{correctKey.toUpperCase()}. {q[`đáp án ${correctKey}` as keyof Question]}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2 nút song song */}
                <div className="grid grid-cols-2 gap-3">
                  {!showExplanation && (
                    <button
                      onClick={() => setShowExplanation(true)}
                      className="rounded-lg border-2 border-blue-500 bg-blue-50 py-4 text-base font-bold text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
                    >
                      👁️ Xem đáp án
                    </button>
                  )}
                  <button
                    onClick={handleNextQuestion}
                    className={`rounded-lg bg-blue-600 py-4 text-base font-bold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] ${!showExplanation ? '' : 'col-span-2'}`}
                  >
                    {currentQIndex < currentQuestions.length - 1 ? "➡️ Câu tiếp theo" : "🏁 Xem kết quả"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // UI: RESULT
  if (gameState === "result") {
    const percentage = Math.round((score / currentQuestions.length) * 100);
    
    return (
      <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4 py-8">
        <div className="w-full max-w-3xl rounded-xl bg-white p-8 shadow-xl">
          <div className="text-center border-b pb-8">
            <h2 className="mb-2 text-2xl font-bold text-gray-800">Kết quả bài làm</h2>
            <div className={`text-6xl font-extrabold my-6 ${percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-blue-600' : 'text-red-500'}`}>
              {score}/{currentQuestions.length}
            </div>
            <p className="text-gray-500 mb-6">
              {percentage >= 80 ? "Xuất sắc! Bạn nắm kiến thức rất chắc." : percentage >= 50 ? "Khá tốt, hãy cố gắng thêm nhé." : "Cần ôn tập lại nhiều hơn!"}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setGameState("menu")}
                className="rounded-lg bg-gray-100 px-6 py-3 font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                ⚙️ Cấu hình lại
              </button>
              <button
                onClick={startGame}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 transition shadow-lg hover:shadow-blue-500/30"
              >
                🔄 Làm lại đề này
              </button>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="mb-6 text-lg font-bold text-gray-700 flex items-center gap-2">
              <span>📋</span> Chi tiết đáp án
            </h3>
            <div className="space-y-4">
              {currentQuestions.map((q, index) => {
                const historyItem = history.find(h => h.questionIndex === index);
                const userChoice = historyItem?.selectedKey;
                const correctKey = q["đáp án đúng"]?.trim().toLowerCase();
                const isCorrect = userChoice === correctKey;

                // @ts-ignore
                const getOptionContent = (key) => q[`đáp án ${key}`] || "";

                return (
                  <div key={index} className={`rounded-lg border p-4 transition-all ${isCorrect ? "border-gray-200 bg-white hover:border-green-200" : "border-red-200 bg-red-50/50"}`}>
                    <div className="flex gap-3">
                      <div className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isCorrect ? "bg-green-500" : "bg-red-500"}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-lg mb-3">{renderQuestionText(q["câu hỏi"])}</p>
                        
                        <div className="flex flex-col gap-2">
                          {["a", "b", "c", "d"].map((key) => {
                            // @ts-ignore
                            const content = q[`đáp án ${key}`];
                            const isSelected = userChoice === key;
                            const isThisCorrect = correctKey === key;
                            
                            let optionClass = "border-gray-200 bg-gray-50 text-gray-500";
                            
                            if (isThisCorrect) {
                              optionClass = "border-green-500 bg-green-50 text-green-800 font-bold ring-1 ring-green-500";
                            } else if (isSelected) {
                              // Nếu chọn sai thì tô đỏ
                              optionClass = "border-red-500 bg-red-50 text-red-800 font-medium";
                            }

                            return (
                              <div 
                                key={key} 
                                className={`flex items-start rounded-lg border p-3 text-sm transition-all ${optionClass} ${!isThisCorrect && !isSelected ? "opacity-70" : ""}`}
                              >
                                <span className={`mr-3 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold uppercase ${
                                  isThisCorrect 
                                  ? "bg-green-500 text-white border-green-500"
                                  : isSelected 
                                  ? "bg-red-500 text-white border-red-500"
                                  : "bg-white text-gray-400 border-gray-300"
                                }`}>
                                  {key}
                                </span>
                                <div>
                                  {content}
                                  {isThisCorrect && <span className="ml-2 text-xs font-bold text-green-600">✓ Đáp án đúng</span>}
                                  {isSelected && !isThisCorrect && <span className="ml-2 text-xs font-bold text-red-600">✗ Bạn chọn</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Hiển thị thêm dòng thông báo kết quả rõ ràng hơn nếu làm sai */}
                        {!isCorrect && (
                          <div className="mt-3 rounded bg-blue-50 p-2 text-sm text-blue-800">
                             👉 Đáp án đúng là: <strong>{correctKey?.toUpperCase()}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return null;
}