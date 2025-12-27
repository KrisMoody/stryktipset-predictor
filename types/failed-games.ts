import type { GameType } from './game-types'

export type FailedGameStatus = 'pending' | 'retry_scheduled' | 'manual_entry' | 'resolved'
export type FailureReason = 'api_error' | 'missing_data' | 'timeout' | 'parse_error'
export type ResolutionType = 'api_retry' | 'manual_entry'

export interface FailedGame {
  id: number
  drawId: number
  matchNumber: number
  gameType: GameType
  failureReason: FailureReason
  errorMessage: string | null
  retryCount: number
  lastRetryAt: Date | null
  status: FailedGameStatus
  resolvedAt: Date | null
  resolvedBy: string | null
  resolutionType: ResolutionType | null
  rawErrorData: unknown | null
  createdAt: Date
  updatedAt: Date
}

export interface ManualGameEntryData {
  homeTeamName: string
  awayTeamName: string
  leagueName: string
  countryName?: string
  startTime: string // ISO date string
  status?: string
}

export interface DrawCompletionStatus {
  drawId: number
  drawNumber: number
  gameType: GameType
  expectedGames: number // 13 for Stryktipset/Europatipset, 8 for Topptipset
  actualGames: number
  failedGames: number
  isComplete: boolean
  canCreateCoupon: boolean
  missingMatchNumbers: number[]
}

export interface FailedGameWithDraw extends FailedGame {
  draw: {
    drawNumber: number
    gameType: GameType
    drawDate: Date
    status: string
  }
}
