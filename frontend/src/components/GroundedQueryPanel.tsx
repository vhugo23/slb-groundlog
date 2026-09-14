import { useState } from 'react'
import { postQuery, type QueryResult } from '../api'
import './GroundedQueryPanel.css'

interface GroundedQueryPanelProps {
  wellId: number
}

const EXAMPLE_QUESTIONS = [
  'What does the GR log show?',
  'Any flatline flags?',
  'What is the NPHI range?',
  'What is the weather today?',
]

export function GroundedQueryPanel({ wellId }: GroundedQueryPanelProps) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(q?: string) {
    const text = (q ?? question).trim()
    if (!text) return
    setIsQuerying(true)
    setResult(null)
    setError(null)
    try {
      const data = await postQuery(wellId, text)
      setResult(data)
    } catch (err) {
      console.error('Query failed:', err)
      setError(
        'The query service is temporarily unavailable — this well\'s data above is still yours to read; try the question again shortly.'
      )
    } finally {
      setIsQuerying(false)
    }
  }

  return (
    <div>
      <p className="gl-query-flow gl-mono">
        Question&nbsp;→&nbsp;exact record match&nbsp;→&nbsp;PostgreSQL retrieval&nbsp;→&nbsp;Gemini constrained to
        evidence&nbsp;→&nbsp;answer + citation, or refusal
      </p>

      <label className="gl-query-label" htmlFor="gl-query-input">
        Ask from this well&rsquo;s records
      </label>
      <textarea
        id="gl-query-input"
        className="gl-textarea"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. What does the GR log show?"
        rows={3}
      />

      <div className="gl-query-chips">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q} className="gl-chip" onClick={() => { setQuestion(q); submit(q) }} disabled={isQuerying}>
            {q}
          </button>
        ))}
      </div>

      <button
        className="gl-btn gl-btn-primary"
        onClick={() => submit()}
        disabled={isQuerying || !question.trim()}
        style={{ marginTop: 'var(--space-3)' }}
      >
        {isQuerying ? 'Retrieving evidence and checking answer…' : 'Ask'}
      </button>

      {error && <p className="gl-query-error">{error}</p>}

      {result && (result.grounded ? <GroundedAnswer result={result} /> : <RefusalAnswer result={result} />)}
    </div>
  )
}

function GroundedAnswer({ result }: { result: QueryResult }) {
  return (
    <div className="gl-result gl-result-grounded">
      <div className="gl-result-state">
        <span className="gl-badge gl-badge-clean">
          <span className="gl-badge-dot" aria-hidden="true" />
          Grounded answer
        </span>
      </div>
      <p className="gl-result-answer">{result.answer}</p>
      {result.citation && (
        <p className="gl-result-citation gl-mono">
          Evidence used: {result.citation}
        </p>
      )}
      <p className="gl-result-how gl-mono">
        Exact match → retrieved record → constrained model response
      </p>
    </div>
  )
}

function RefusalAnswer({ result }: { result: QueryResult }) {
  return (
    <div className="gl-result gl-result-refused">
      <div className="gl-result-state">
        <span className="gl-badge gl-badge-neutral">
          <span className="gl-badge-dot" aria-hidden="true" />
          Insufficient data — not grounded
        </span>
      </div>
      <p className="gl-result-answer">{result.answer}</p>
      <p className="gl-result-citation gl-mono">No citation attached</p>
      <p className="gl-result-note">
        This isn&rsquo;t an error — refusing to guess when the retrieved records don&rsquo;t support an answer is
        the trust behavior this system is built around.
      </p>
    </div>
  )
}
