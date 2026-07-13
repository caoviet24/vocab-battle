import { create } from "zustand";

// Game status — sync với backend ws/room.go (StatusLobby, StatusPlaying, StatusFinished)
export const GameStatus = {
  LOBBY: "LOBBY",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED",
} as const;

type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface Player {
  player_id: string;
  name: string;
  score: number;
}

export interface BilingualText {
  en?: string;
  vi?: string;
}

export interface Phonetic {
  text?: string;
  audio?: string;
  locale?: string;
}

export interface GameCard {
  word?: string;
  type?: string;
  translation?: string;
  explanation?: BilingualText;
  example?: BilingualText;
  phonetics?: Phonetic[];
  image_url?: string;
}

export interface Question extends GameCard {
  card_id: string;
  word_length: number;
  hint_pattern?: string;
  round?: number;
  total_rounds?: number;
}

export interface WinnerInfo {
  winner_id?: string;
  winner_name?: string;
  card?: GameCard;
  timeout?: boolean;
  last_man?: boolean;
}

interface GameState {
  myPlayerId: string;
  myName: string;
  roomCode: string;
  isHost: boolean; // Cờ đánh dấu mình là Host
  hasPassword: boolean; // Phòng có mật khẩu không (thông báo cho FE)
  players: Player[];
  currentQuestion: Question | null;
  gameStatus: GameStatus;
  winnerInfo: WinnerInfo | null;
  error: string | null;
  readyIds: string[]; // Danh sách player_id đã bấm sẵn sàng tái đấu
  iAmReady: boolean; // Mình đã bấm sẵn sàng chưa

  setMyInfo: (id: string, name: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (v: boolean) => void;
  setHasPassword: (v: boolean) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentQuestion: (q: Question | null) => void;
  setGameStatus: (status: GameStatus) => void;
  setWinnerInfo: (info: WinnerInfo | null) => void;
  setError: (e: string | null) => void;
  setReadyUpdate: (readyIds: string[]) => void;
  setIAmReady: (v: boolean) => void;
  resetRoom: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  myPlayerId: "",
  myName: "",
  roomCode: "",
  isHost: false,
  hasPassword: false,
  players: [],
  currentQuestion: null,
  gameStatus: "LOBBY",
  winnerInfo: null,
  error: null,
  readyIds: [],
  iAmReady: false,

  setMyInfo: (id, name) => set({ myPlayerId: id, myName: name }),
  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (v) => set({ isHost: v }),
  setHasPassword: (v) => set({ hasPassword: v }),
  setPlayers: (players) => set({ players }),
  setCurrentQuestion: (q) => set({ currentQuestion: q, winnerInfo: null }),
  setGameStatus: (status) => set({ gameStatus: status }),
  setWinnerInfo: (info) => set({ winnerInfo: info }),
  setError: (e) => set({ error: e }),
  setReadyUpdate: (readyIds) => set({ readyIds }),
  setIAmReady: (v) => set({ iAmReady: v }),
  resetRoom: () =>
    set({
      players: [],
      currentQuestion: null,
      gameStatus: "LOBBY",
      winnerInfo: null,
      isHost: false,
      hasPassword: false,
      error: null,
      readyIds: [],
      iAmReady: false,
    }),
}));
