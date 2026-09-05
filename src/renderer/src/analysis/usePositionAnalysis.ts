// "一键分析"的状态容器：拿一个棋盘 + 该谁走，跑一次阶段8的单次分析，把过程状态暴露出来。
//
// 为什么把状态放在这个hook里而不是放在分析面板组件内部：打谱页右侧的棋谱树和AI分析面板是
// 互斥切换的（像浏览器切标签页），分析面板一旦被切走就会卸载。状态留在组件里，切回来
// 结果就没了、还得重新等引擎跑一遍；提到调用方那一层，来回切标签页结果一直在。
//
// 分析发起时会记下当时的FEN（analyzedFen）。用户在棋谱树上跳到别的局面之后，
// 调用方比对一下就知道面板上显示的结论已经不是当前棋盘的了，可以提示"重新分析"。

import { useRef, useState } from 'react'
import { boardToFen } from '@shared/chess'
import type { Board, Side } from '@shared/chess'
import { runSinglePositionAnalysis, type SingleAnalysisResult } from './singlePositionAnalysis'

export interface PositionAnalysisState {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: SingleAnalysisResult | null
  error: string | null
  /** 这份结果是对哪个局面算出来的；还没分析过时为null */
  analyzedFen: string | null
}

export interface UsePositionAnalysisResult extends PositionAnalysisState {
  analyze: (board: Board, sideToMove: Side) => Promise<void>
  reset: () => void
}

const IDLE: PositionAnalysisState = { status: 'idle', result: null, error: null, analyzedFen: null }

export function usePositionAnalysis(): UsePositionAnalysisResult {
  const [state, setState] = useState<PositionAnalysisState>(IDLE)
  // 用户连点两次"分析"、或者分析途中又换了局面时，只认最后一次请求的结果，
  // 免得先发出去的那次慢一拍返回、把新结果盖掉
  const requestIdRef = useRef(0)

  async function analyze(board: Board, sideToMove: Side): Promise<void> {
    const fen = boardToFen(board, sideToMove)
    const requestId = ++requestIdRef.current
    setState({ status: 'loading', result: null, error: null, analyzedFen: fen })
    try {
      const result = await runSinglePositionAnalysis(board, sideToMove, window.chessoc.engine.analyzePosition)
      if (requestIdRef.current !== requestId) return
      setState({ status: 'done', result, error: null, analyzedFen: fen })
    } catch (err) {
      if (requestIdRef.current !== requestId) return
      setState({
        status: 'error',
        result: null,
        error: err instanceof Error ? err.message : String(err),
        analyzedFen: fen
      })
    }
  }

  function reset(): void {
    requestIdRef.current++
    setState(IDLE)
  }

  return { ...state, analyze, reset }
}
