// 一覧・詳細の取得で「投稿間・タブ間を素早く行き来したとき、先に始まった取得の
// 応答が後から届いて新しい表示を上書きしてしまう」のを防ぐための世代トークン。
//
// 使い方: composableごとに1つ createLatestRequest() を持ち、取得関数の入口で
// begin() を呼んでトークンを受け取る。await のたび（応答を state に反映する直前・
// finally で loading を戻す前）に token.isStale() を確認し、true なら「この応答は
// もう古い（後発の取得が始まっている）」ので結果を捨てる。
//
// これまで useComments / usePostDetail の latestRequestedPostId、useTimeline の
// loadSeq として個別に書かれていたものを1箇所にまとめたもの。
export interface RequestToken {
  /** この取得より後に begin() が呼ばれていれば true（＝この応答はもう反映してはいけない）。 */
  isStale(): boolean
}

export interface LatestRequest {
  /** 新しい取得の開始を記録し、その取得用のトークンを返す。 */
  begin(): RequestToken
}

export function createLatestRequest(): LatestRequest {
  let current = 0
  return {
    begin() {
      const seq = ++current
      return { isStale: () => seq !== current }
    },
  }
}
