"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import type {
  Player,
  Question,
  RoomConfig,
  ServerMessage,
  ServerPayload,
} from "@/types/type";

const fallbackImages = [
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfHamsv62d-POKkuPTE831SLJRLK65dbPUpQTjbnnaSg&s=10",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpxP2MDm_pJSEsDemp5_L_O84xM5DwShw8afmYnFPaiQ&s=10",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGnz9PkjM3e681O_G07WWzIF7jBfPqa-ryCwususEQ7w&s=10",
];

export function useGameService(roomCode: string, enabled = true) {
  const socketRef = useRef<WebSocket | null>(null);
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const myName = useGameStore((state) => state.myName);
  const myFrameUrl = useGameStore((state) => state.myFrameUrl);

  const send = useCallback((message: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    if (!enabled || !myPlayerId) return;

    const password =
      sessionStorage.getItem(`pending_password_${roomCode}`) ?? "";
    const isHost =
      sessionStorage.getItem(`pending_isHost_${roomCode}`) ?? "0";
    const query = new URLSearchParams({
      playerId: myPlayerId,
      playerName: myName,
      password,
      isHost,
    });
    if (myFrameUrl) query.set("frameUrl", myFrameUrl);
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL ?? ""}/ws/room/${roomCode}?${query}`,
    );
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current === socket) useGameStore.getState().setError(null);
    };
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;

      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      const state = useGameStore.getState();
      const payload = message.payload as ServerPayload;
      switch (message.type) {
        case "ROOM_STATE":
          state.setPlayers(payload.players ?? []);
          state.setIsHost(payload.is_host ?? false);
          state.setHasPassword(payload.has_password ?? false);
          break;
        case "PLAYER_JOINED":
        case "PLAYER_LEFT":
          state.setPlayers(message.payload as Player[]);
          break;
        case "NEXT_QUESTION":
          state.setGameStatus("PLAYING");
          state.setCurrentQuestion({
            ...payload,
            image_url:
              payload.image_url ||
              fallbackImages[Math.floor(Math.random() * fallbackImages.length)],
          } as Question);
          state.setWrongAnswers([]);
          state.setPhoneticsData(null);
          state.setAnswerInput("");
          state.setTimeRemaining(30);
          state.setLastTotalRounds(payload.total_rounds ?? 0);
          state.setReadyUpdate([]);
          state.setIAmReady(false);
          break;
        case "PHONETICS":
          state.setPhoneticsData(payload.phonetics ?? []);
          break;
        case "WRONG_ANSWER":
          state.addWrongAnswer({
            player_name: payload.player_name ?? "Người chơi",
            answer: payload.answer ?? "",
          });
          break;
        case "CORRECT_ANSWER":
          state.setWinnerInfo({
            winner_id: payload.winner_id,
            winner_name: payload.winner_name,
            card: payload.card,
          });
          state.setPlayers(payload.scoreboard ?? []);
          break;
        case "TIMEOUT_SKIP":
          state.setWinnerInfo({ card: payload.card, timeout: true });
          state.setPlayers(payload.scoreboard ?? []);
          break;
        case "LAST_MAN_STANDING":
          state.setWinnerInfo({
            winner_name: payload.winner_name,
            last_man: true,
          });
          state.setPlayers(payload.scoreboard ?? []);
          window.setTimeout(() => {
            const current = useGameStore.getState();
            current.setGameStatus("LOBBY");
            current.setWinnerInfo(null);
            current.setCurrentQuestion(null);
            current.setWrongAnswers([]);
            current.setPhoneticsData(null);
            current.setAnswerInput("");
            current.setTimeRemaining(30);
          }, 3000);
          break;
        case "GAME_OVER":
          state.setPlayers(message.payload as Player[]);
          state.setGameStatus("FINISHED");
          state.setWinnerInfo(null);
          state.setCurrentQuestion(null);
          state.setWrongAnswers([]);
          state.setPhoneticsData(null);
          state.setAnswerInput("");
          state.setTimeRemaining(30);
          break;
        case "ERROR":
          state.setError(payload.message ?? "Có lỗi xảy ra");
          if (payload.code === "WRONG_PASSWORD") {
            window.setTimeout(() => (window.location.href = "/"), 2000);
          }
          break;
        case "HOST_LEFT":
          state.setError(payload.message ?? "Chủ phòng đã thoát");
          window.setTimeout(() => (window.location.href = "/"), 2500);
          break;
        case "READY_UPDATE":
          state.setReadyUpdate(payload.ready_ids ?? []);
          break;
      }
    };
    socket.onerror = () => {
      if (socketRef.current === socket) {
        useGameStore.getState().setError("Không thể kết nối tới máy chủ");
      }
    };
    socket.onclose = () => {
      if (socketRef.current === socket) window.location.href = "/";
    };

    return () => {
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [enabled, myFrameUrl, myName, myPlayerId, roomCode]);

  const startGame = useCallback(() => {
    const saved = sessionStorage.getItem(`room_config_${roomCode}`);
    let config: RoomConfig = { category: "random", totalQuestions: 10 };
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<RoomConfig>;
        config = {
          category: parsed.category || "random",
          totalQuestions: parsed.totalQuestions || 10,
        };
      } catch {
        // Use defaults when session data is malformed.
      }
    }
    send({
      type: "START_GAME",
      payload: {
        category_id: config.category,
        total_questions: config.totalQuestions,
      },
    });
  }, [roomCode, send]);

  const submitAnswer = useCallback(
    (answer: string) => {
      send({ type: "SUBMIT_ANSWER", payload: { answer } });
      useGameStore.getState().setAnswerInput("");
    },
    [send],
  );
  const requestPhonetics = useCallback(
    () => send({ type: "GET_PHONETICS" }),
    [send],
  );
  const timeout = useCallback(() => send({ type: "TIMEOUT" }), [send]);
  const setReady = useCallback(() => {
    const state = useGameStore.getState();
    if (state.iAmReady) return;
    state.setIAmReady(true);
    send({ type: "SET_READY" });
  }, [send]);
  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    window.location.href = "/";
  }, []);

  return {
    startGame,
    submitAnswer,
    requestPhonetics,
    timeout,
    setReady,
    leaveRoom,
  };
}
