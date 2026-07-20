export type HomeMode = "join" | "create";
export type GameStatus = "LOBBY" | "PLAYING" | "FINISHED";

export interface BilingualText {
  en: string;
  vi: string;
}

export interface Phonetic {
  text: string;
  audio: string;
  locale: string;
}

export interface Category {
  category_id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string;
}

export interface Card {
  card_id: string;
  word: string;
  type: string;
  explanation: BilingualText;
  translation: string;
  example: BilingualText;
  phonetics: Phonetic[];
  image_url: string;
  difficulty: string;
  category_id: string;
}

export type CardForm = Omit<Card, "card_id">;
export interface CardUpdate {
  id: string;
  card: CardForm;
}

export type CategoryForm = Pick<Category, "name" | "description" | "image_url">;
export interface CategoryUpdate extends CategoryForm {
  id: string;
}

export interface CardQuery {
  categoryId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Player {
  player_id: string;
  name: string;
  score: number;
}

export interface RoomInfo {
  code: string;
  status: string;
  host_id: string;
  has_password: boolean;
  player_count: number;
  players: Player[];
}

export interface LobbyMessage {
  type: string;
  payload: RoomInfo[];
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

export interface WrongAnswer {
  player_name: string;
  answer: string;
}

export interface RoomConfig {
  category: string;
  totalQuestions: number;
}

export interface ServerPayload extends Partial<Question> {
  players?: Player[];
  scoreboard?: Player[];
  card?: GameCard;
  is_host?: boolean;
  has_password?: boolean;
  player_name?: string;
  answer?: string;
  winner_id?: string;
  winner_name?: string;
  ready_ids?: string[];
  phonetics?: Phonetic[];
  message?: string;
  code?: string;
}

export interface ServerMessage {
  type: string;
  payload: ServerPayload | Player[];
}

export interface GameState {
  myPlayerId: string;
  myName: string;
  roomCode: string;
  isHost: boolean;
  hasPassword: boolean;
  players: Player[];
  currentQuestion: Question | null;
  gameStatus: GameStatus;
  winnerInfo: WinnerInfo | null;
  error: string | null;
  readyIds: string[];
  iAmReady: boolean;
  answerInput: string;
  timeRemaining: number;
  wrongAnswers: WrongAnswer[];
  phoneticsData: Phonetic[] | null;
  lastTotalRounds: number;
  setMyInfo: (id: string, name: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (value: boolean) => void;
  setHasPassword: (value: boolean) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentQuestion: (question: Question | null) => void;
  setGameStatus: (status: GameStatus) => void;
  setWinnerInfo: (info: WinnerInfo | null) => void;
  setError: (error: string | null) => void;
  setReadyUpdate: (readyIds: string[]) => void;
  setIAmReady: (value: boolean) => void;
  setAnswerInput: (answer: string) => void;
  setTimeRemaining: (seconds: number) => void;
  setWrongAnswers: (answers: WrongAnswer[]) => void;
  addWrongAnswer: (answer: WrongAnswer) => void;
  setPhoneticsData: (phonetics: Phonetic[] | null) => void;
  setLastTotalRounds: (rounds: number) => void;
  resetRoom: () => void;
}
