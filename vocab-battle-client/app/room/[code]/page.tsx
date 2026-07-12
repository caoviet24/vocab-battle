"use client";

import { useEffect, useRef, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/lib/store";
import {
  Trophy,
  Users,
  Zap,
  CheckCircle2,
  Crown,
  AlertCircle,
  Volume2,
  RotateCcw,
  LogOut,
} from "lucide-react";

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.code;

  const ws = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const {
    myPlayerId,
    myName,
    players,
    setPlayers,
    currentQuestion,
    setCurrentQuestion,
    gameStatus,
    setGameStatus,
    winnerInfo,
    setWinnerInfo,
    isHost,
    setIsHost,
    setHasPassword,
    error,
    setError,
    readyIds,
    setReadyUpdate,
    iAmReady,
    setIAmReady,
  } = useGameStore();

  const [answerInput, setAnswerInput] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(30); // Timer 30s
  const [wrongAnswers, setWrongAnswers] = useState<
    { player_name: string; answer: string }[]
  >([]);
  const [phoneticsData, setPhoneticsData] = useState<any>(null); // Nhận từ server khi bấm nghe
  const [lastTotalRounds, setLastTotalRounds] = useState(0); // Tổng số câu cho thống kê cuối trận

  // Countdown timer cho mỗi câu hỏi
  useEffect(() => {
    if (gameStatus !== "PLAYING" || !currentQuestion || winnerInfo) {
      return;
    }

    // Reset timer khi có câu hỏi mới
    setTimeRemaining(30);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Nếu là host và hết giờ, gửi TIMEOUT để server skip câu hỏi
          if (isHost && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "TIMEOUT" }));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion, gameStatus, winnerInfo, isHost]);

  // Request phonetics từ server, play khi nhận được
  const requestPhonetics = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "GET_PHONETICS" }));
    }
  };

  // Khi có phonetics từ server → play audio
  useEffect(() => {
    if (phoneticsData?.phonetics?.[0]?.audio) {
      const audio = new Audio(phoneticsData.phonetics[0].audio);
      audio.play();
    }
  }, [phoneticsData]);

  // Auto-focus ô input khi vào câu hỏi mới
  useEffect(() => {
    if (currentQuestion && gameStatus === "PLAYING" && !winnerInfo) {
      answerInputRef.current?.focus();
    }
  }, [currentQuestion, gameStatus, winnerInfo]);

  // Generate letter boxes display
  const getLetterBoxes = () => {
    if (!currentQuestion?.word_length) return [];

    // Nếu còn > 15s: hiện tất cả blank
    if (timeRemaining > 15) {
      return Array(currentQuestion.word_length).fill("_");
    }

    // Nếu <= 15s: hiện hint_pattern
    if (currentQuestion.hint_pattern) {
      return currentQuestion.hint_pattern.split("");
    }

    return Array(currentQuestion.word_length).fill("_");
  };

  useEffect(() => {
    if (!myPlayerId) return;

    // Đọc password và isHost từ sessionStorage (được set ở trang home)
    const password =
      sessionStorage.getItem(`pending_password_${roomCode}`) || "";
    const isHostFlag =
      sessionStorage.getItem(`pending_isHost_${roomCode}`) || "0";

    // ponytail: dùng hostname hiện tại → hoạt động cả qua LAN IP
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${window.location.hostname}:8080/ws`;
    const url = `${wsUrl}/room/${roomCode}?playerId=${myPlayerId}&playerName=${encodeURIComponent(myName)}&password=${encodeURIComponent(password)}&isHost=${isHostFlag}`;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setError(null);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "ROOM_STATE":
          // Server gửi trạng thái phòng ngay khi connect: players, is_host, has_password
          setPlayers(data.payload.players || []);
          setIsHost(data.payload.is_host || false);
          setHasPassword(data.payload.has_password || false);
          break;

        case "PLAYER_JOINED":
        case "PLAYER_LEFT":
          setPlayers(data.payload);
          break;

        case "NEXT_QUESTION":
          setGameStatus("PLAYING");
          setCurrentQuestion(data.payload);
          setWrongAnswers([]); // Clear wrong answers khi câu hỏi mới
          setPhoneticsData(null); // Clear phonetics cũ
          setAnswerInput(""); // Clear đáp án cũ khi sang câu mới
          setLastTotalRounds(data.payload.total_rounds || 0);
          setReadyUpdate([]); // Reset ready state khi game bắt đầu
          setIAmReady(false);
          break;

        case "PHONETICS":
          setPhoneticsData(data.payload);
          break;

        case "WRONG_ANSWER":
          setWrongAnswers((prev) => [
            ...prev,
            {
              player_name: data.payload.player_name,
              answer: data.payload.answer,
            },
          ]);
          break;

        case "CORRECT_ANSWER":
          setWinnerInfo(data.payload);
          setPlayers(data.payload.scoreboard);
          break;

        case "TIMEOUT_SKIP":
          // Hết giờ, không ai đoán được - hiển thị đáp án
          setWinnerInfo({ card: data.payload.card, timeout: true });
          setPlayers(data.payload.scoreboard);
          break;

        case "LAST_MAN_STANDING":
          // Đối thủ thoát → mình thắng, về lobby
          setWinnerInfo({
            winner_name: data.payload.winner_name,
            last_man: true,
          });
          setPlayers(data.payload.scoreboard);
          // Reset game về lobby sau 3s
          setTimeout(() => {
            setGameStatus("LOBBY");
            setWinnerInfo(null);
            setCurrentQuestion(null);
            setWrongAnswers([]);
            setPhoneticsData(null);
          }, 3000);
          break;

        case "GAME_OVER":
          setPlayers(data.payload);
          setGameStatus("FINISHED");
          setWinnerInfo(null);
          setCurrentQuestion(null);
          setWrongAnswers([]);
          setPhoneticsData(null);
          setTimeRemaining(30);
          break;

        case "ERROR":
          // Server từ chối (sai password, không phải host start game, v.v.)
          setError(data.payload.message || "Có lỗi xảy ra");
          if (data.payload.code === "WRONG_PASSWORD") {
            // Quay về trang chủ sau 2s
            setTimeout(() => (window.location.href = "/"), 2000);
          }
          break;

        case "HOST_LEFT":
          // Host đã thoát khỏi phòng → báo toast + quay về trang chủ
          setError(data.payload.message || "Chủ phòng đã thoát");
          setTimeout(() => (window.location.href = "/"), 2500);
          break;

        case "READY_UPDATE":
          setReadyUpdate(data.payload.ready_ids || []);
          break;
      }
    };

    ws.current.onerror = () => {
      setError("Không thể kết nối tới server");
    };

    ws.current.onclose = () => {
      if (isMountedRef.current) {
        // Component còn mounted → đây là disconnect bất ngờ (reload/network) → redirect về /
        window.location.href = "/";
      }
    };

    return () => {
      isMountedRef.current = false;
      ws.current?.close();
    };
  }, [
    roomCode,
    myPlayerId,
    myName,
    setPlayers,
    setCurrentQuestion,
    setWinnerInfo,
    setGameStatus,
    setIsHost,
    setHasPassword,
    setError,
  ]);

  const startGame = () => {
    // Đọc config được lưu khi tạo phòng
    const configData = sessionStorage.getItem(`room_config_${roomCode}`);
    const config = configData
      ? JSON.parse(configData)
      : { category: "random", totalQuestions: 10 };

    ws.current?.send(
      JSON.stringify({
        type: "START_GAME",
        payload: {
          category_id: config.category,
          total_questions: config.totalQuestions,
        },
      }),
    );
  };

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || winnerInfo) return;

    ws.current?.send(
      JSON.stringify({
        type: "SUBMIT_ANSWER",
        payload: { answer: answerInput },
      }),
    );
    setAnswerInput("");
    answerInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="bg-pink-500/20 p-2 rounded-lg">
              <Zap className="text-pink-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Phòng: {roomCode}</h2>
              <p className="text-sm text-gray-400 flex items-center gap-2">
                {myName}
                {isHost && <Crown size={16} className="text-yellow-400" />}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-xl border border-blue-500/30">
            <Users size={20} className="text-blue-400" />
            <span className="font-bold text-blue-400">{players.length}</span>
          </div>
        </header>

        {/* Hiển thị lỗi nếu có */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3"
          >
            <AlertCircle
              className="text-red-400 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <p className="text-red-200 font-medium">{error}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* SẢNH CHỜ LOBBY */}
          {gameStatus === "LOBBY" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <Users size={40} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  Đang chờ người chơi...
                </h3>
                <p className="text-gray-400 mb-8 text-center">
                  Hãy chia sẻ mã phòng <strong>{roomCode}</strong> cho bạn bè
                </p>

                {/* Chỉ hiện nút Start cho Host và khi có >= 2 người */}
                {isHost ? (
                  <button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className="w-full py-4 bg-pink-600 hover:bg-pink-700 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(219,39,119,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-pink-600"
                  >
                    {players.length < 2
                      ? "Cần ít nhất 2 người chơi"
                      : "Bắt Đầu Trận Đấu"}
                  </button>
                ) : (
                  <div className="w-full py-4 bg-white/5 rounded-xl text-center text-gray-400 border border-white/10">
                    Đang chờ chủ phòng bắt đầu...
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users size={24} className="text-blue-400" /> Danh sách
                </h3>
                <ul className="space-y-3">
                  {players.map((p) => (
                    <motion.li
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={p.player_id}
                      className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5"
                    >
                      <span className="font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        {p.name} {p.player_id === myPlayerId && "(Bạn)"}
                        {/* ponytail: hiện host badge chỉ dựa vào isHost từ server, không check PlayerID === hostID ở client */}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {p.score} pt
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* ĐANG CHƠI */}
          {gameStatus === "PLAYING" && currentQuestion && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Bảng xếp hạng realtime ở bên cạnh */}
              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sticky top-4">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Trophy size={24} className="text-yellow-400" /> Bảng Xếp
                    Hạng
                  </h3>
                  <ul className="space-y-2">
                    {[...players]
                      .sort((a, b) => b.score - a.score)
                      .map((p, idx) => (
                        <motion.li
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={p.player_id}
                          className={`flex justify-between items-center p-3 rounded-xl border ${idx === 0 ? "bg-yellow-500/20 border-yellow-500/50" : "bg-black/40 border-white/5"}`}
                        >
                          <span className="font-medium flex items-center gap-2">
                            <span
                              className={
                                idx === 0
                                  ? "text-yellow-400 font-bold"
                                  : "text-gray-500"
                              }
                            >
                              #{idx + 1}
                            </span>
                            {p.name} {p.player_id === myPlayerId && "(Bạn)"}
                          </span>
                          <span className="font-mono font-bold text-blue-400">
                            {p.score}
                          </span>
                        </motion.li>
                      ))}
                  </ul>
                </div>
              </div>

              {/* Khung câu hỏi chính */}
              <div className="lg:col-span-2 order-1 lg:order-2">
                <div className="bg-gradient-to-b from-indigo-900/50 to-black/50 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <AnimatePresence>
                    {winnerInfo && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`absolute inset-0 ${winnerInfo.timeout ? "bg-red-900/90" : winnerInfo.last_man ? "bg-yellow-900/90" : "bg-green-900/90"} z-10 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm`}
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                          transition={{ type: "tween", duration: 0.5 }}
                        >
                          <CheckCircle2
                            size={80}
                            className={
                              winnerInfo.timeout
                                ? "text-red-400"
                                : winnerInfo.last_man
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }
                          />
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {winnerInfo.timeout
                            ? "Hết giờ! Không ai đoán được"
                            : winnerInfo.last_man
                              ? `${winnerInfo.winner_name} thắng! Đối thủ đã thoát`
                              : `${winnerInfo.winner_name} đã đoán đúng!`}
                        </h2>
                        {winnerInfo.card?.word && (
                          <p className="text-xl text-green-300 font-mono bg-black/30 px-6 py-3 rounded-xl mt-4">
                            Từ vựng:{" "}
                            <span className="font-bold text-white">
                              {winnerInfo.card.word}
                            </span>
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Timer hiển thị ở góc trên phải */}
                  <div className="absolute top-6 right-6 z-20">
                    <div
                      className={`text-4xl font-black font-mono px-5 py-3 rounded-2xl ${timeRemaining <= 5 ? "bg-red-500/30 text-red-300 animate-pulse" : timeRemaining <= 15 ? "bg-yellow-500/30 text-yellow-300" : "bg-blue-500/30 text-blue-300"}`}
                    >
                      {timeRemaining}s
                    </div>
                  </div>

                  {/* Hiển thị ảnh nếu có */}
                  {currentQuestion.image_url && (
                    <div className="mb-6 flex justify-center">
                      <img
                        src={currentQuestion.image_url}
                        alt="hint"
                        className="max-h-48 rounded-2xl border-2 border-white/20 shadow-lg"
                      />
                    </div>
                  )}

                  {/* Round counter */}
                  <div className="text-center mb-4 mt-6">
                    {currentQuestion.round && currentQuestion.total_rounds && (
                      <span className="inline-block px-4 py-1 bg-pink-500/20 text-pink-300 rounded-full text-lg font-bold">
                        Vòng {currentQuestion.round}/
                        {currentQuestion.total_rounds}
                      </span>
                    )}
                  </div>

                  {/* Letter boxes hiển thị độ dài từ */}
                  <div className="flex justify-center gap-2 mb-4 flex-wrap">
                    {getLetterBoxes().map((letter: string, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="w-12 h-14 bg-white/10 border-2 border-indigo-400/50 rounded-xl flex items-center justify-center text-2xl font-bold uppercase"
                      >
                        {letter === "_" ? "" : letter}
                      </motion.div>
                    ))}
                  </div>

                  {/* Phonetic - chỉ hiện 7s cuối, hiển thị phonetic text ngay */}
                  {timeRemaining <= 7 && (
                    <div className="text-center mb-4">
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={requestPhonetics}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl font-bold transition-all shadow-lg mx-auto"
                      >
                        <Volume2 size={20} />
                        {currentQuestion.phonetics_text && (
                          <span className="text-purple-200 text-base">
                            {currentQuestion.phonetics_text}
                          </span>
                        )}
                      </motion.button>
                    </div>
                  )}

                  {currentQuestion.translation && (
                    <div className="bg-white/5 rounded-2xl p-2 mb-3 text-center">
                      <div className="flex flex-row margin-auto items-center justify-center gap-2 py-2">
                        <p className="text-sm text-gray-400">Bản dịch:</p>
                        <p className="text-xl text-blue-300 font-bold">
                          {currentQuestion.translation}
                        </p>
                      </div>
                      <p className="text-xs text-indigo-300 mt-2">
                        <span className="px-3 py-1 bg-indigo-500/20 rounded-full uppercase tracking-widest">
                          {currentQuestion.type || "word"}
                        </span>
                      </p>
                    </div>
                  )}

                  {(currentQuestion.explanation?.vi ||
                    currentQuestion.explanation?.en) && (
                    <div className="bg-white/5 rounded-2xl p-4 mb-3 text-left">
                      <p className="text-sm text-gray-400 mb-2">Giải thích:</p>
                      {currentQuestion.explanation?.vi && (
                        <p className="text-lg text-white leading-relaxed italic mb-2">
                          💬 {currentQuestion.explanation.en}
                        </p>
                      )}
                      {currentQuestion.explanation?.en && (
                        <p className="text-sm text-gray-300 leading-relaxed">
                          → {currentQuestion.explanation.vi}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ví dụ: tiếng Anh + bản dịch */}
                  {(currentQuestion.example?.en ||
                    currentQuestion.example?.vi) && (
                    <div className="bg-indigo-500/10 rounded-2xl p-4 mb-3 text-left border border-indigo-500/20">
                      <p className="text-sm text-gray-400 mb-1">📌 Ví dụ:</p>
                      {currentQuestion.example?.en && (
                        <p className="text-lg text-white font-medium mb-1">
                          {currentQuestion.example.en}
                        </p>
                      )}
                      {currentQuestion.example?.vi && (
                        <p className="text-sm text-gray-300 italic">
                          → {currentQuestion.example.vi}
                        </p>
                      )}
                    </div>
                  )}

                  <form onSubmit={submitAnswer} className="relative z-0">
                    <input
                      ref={answerInputRef}
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      disabled={!!winnerInfo || timeRemaining === 0}
                      placeholder={
                        timeRemaining === 0
                          ? "Hết giờ!"
                          : "Gõ nhanh đáp án của bạn..."
                      }
                      className="w-full bg-white/10 border-2 border-indigo-500/50 rounded-2xl px-6 py-5 text-2xl text-center text-white placeholder-gray-400 focus:outline-none focus:border-pink-500 focus:bg-white/20 transition-all disabled:opacity-50"
                      autoFocus
                    />
                    <button type="submit" className="hidden">
                      Submit
                    </button>
                  </form>

                  {/* Các từ user đoán - max height để tránh scroll màn hình */}
                  {wrongAnswers.length > 0 && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-xs text-red-300 mb-1">
                        Đáp án đã đoán:
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {wrongAnswers.map((wa, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-red-500/20 text-red-200 rounded-lg text-xs"
                          >
                            {wa.player_name}:{" "}
                            <span className="font-bold">{wa.answer}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* KẾT QUẢ CUỐI CÙNG */}
          {gameStatus === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto bg-gradient-to-br from-yellow-900/40 to-black border border-yellow-500/30 rounded-3xl p-8 text-center"
            >
              <Trophy size={80} className="text-yellow-400 mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
                KẾT QUẢ CHUNG CUỘC
              </h2>

              {/* Nhà vô địch */}
              {[...players].sort((a, b) => b.score - a.score)[0] && (
                <p className="text-lg text-yellow-300 mb-6">
                  🏆{" "}
                  <strong>
                    {[...players].sort((a, b) => b.score - a.score)[0].name}
                  </strong>{" "}
                  là nhà vô địch!
                </p>
              )}

              {/* Thống kê trận */}
              <div className="flex justify-center gap-4 mb-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
                  <p className="text-2xl font-bold text-white">
                    {lastTotalRounds}
                  </p>
                  <p className="text-xs text-gray-400">Câu hỏi</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
                  <p className="text-2xl font-bold text-white">
                    {players.length}
                  </p>
                  <p className="text-xs text-gray-400">Người chơi</p>
                </div>
              </div>

              <div className="space-y-4">
                {[...players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, idx) => (
                    <div
                      key={p.player_id}
                      className={`flex justify-between items-center p-5 rounded-2xl border ${idx === 0 ? "bg-yellow-500/20 border-yellow-500/50" : "bg-white/5 border-white/10"}`}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-2xl font-black ${idx === 0 ? "text-yellow-400" : "text-gray-500"}`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="text-xl font-medium">{p.name}</span>
                      </div>
                      <span className="text-2xl font-mono font-bold">
                        {p.score}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="mt-8">
                {/* Hiển thị trạng thái ready của mỗi player */}
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-gray-400 mb-2">
                    Sẵn sàng tái đấu ({readyIds.length}/{players.length})
                  </p>
                  {[...players].map((p) => {
                    const ready = readyIds.includes(p.player_id);
                    return (
                      <div
                        key={p.player_id}
                        className={`flex justify-between items-center px-4 py-2 rounded-xl border ${
                          ready
                            ? "bg-green-500/10 border-green-500/40"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {ready ? (
                            <CheckCircle2 size={16} className="text-green-400" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border-2 border-gray-500" />
                          )}
                          <span
                            className={`font-medium ${ready ? "text-green-300" : "text-gray-300"}`}
                          >
                            {p.name}
                            {p.player_id === myPlayerId && " (Bạn)"}
                          </span>
                        </span>
                        <span
                          className={`text-xs font-medium ${ready ? "text-green-400" : "text-gray-500"}`}
                        >
                          {ready ? "✓ Sẵn sàng" : "Chờ..."}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-3">
                  {/* Nút Sẵn sàng / Hủy sẵn sàng — cho tất cả player */}
                  <button
                    onClick={() => {
                      if (iAmReady) return;
                      setIAmReady(true);
                      ws.current?.send(JSON.stringify({ type: "SET_READY" }));
                    }}
                    disabled={iAmReady}
                    className={`w-full px-8 py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-lg ${
                      iAmReady
                        ? "bg-green-600/50 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    <CheckCircle2 size={20} />
                    {iAmReady ? "Đã sẵn sàng" : "Sẵn sàng tái đấu"}
                  </button>

                  {/* Nút Start — chỉ host, chỉ hiện khi tất cả đã ready */}
                  {isHost && readyIds.length === players.length && players.length >= 2 && (
                    <button
                      onClick={startGame}
                      className="w-full px-8 py-4 bg-pink-600 hover:bg-pink-700 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-lg"
                    >
                      <RotateCcw size={20} /> Bắt đầu tái đấu
                    </button>
                  )}

                  {isHost && readyIds.length < players.length && (
                    <div className="px-8 py-3 bg-white/5 rounded-xl text-gray-400 text-center border border-white/10 text-sm">
                      Đang chờ tất cả người chơi sẵn sàng
                    </div>
                  )}

                  <button
                    onClick={() => (window.location.href = "/")}
                    className="w-full px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut size={20} /> Thoát
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
