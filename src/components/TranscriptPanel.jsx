import { useRef, useEffect } from 'react'

export default function TranscriptPanel({ label, finalText, interimText }) {
  const boxRef = useRef(null)

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight
    }
  }, [finalText, interimText])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-[#444] px-1 pb-1.5">
        {label}
      </div>
      <div
        ref={boxRef}
        className="flex-1 bg-[#161616] border border-[#222] rounded-[10px] overflow-y-auto p-3 scrollbar-thin"
      >
        <div className="text-[13px] leading-relaxed text-[#ddd] whitespace-pre-wrap break-words">
          {finalText && <span>{finalText} </span>}
          {interimText && <span className="text-[#555] italic">{interimText}</span>}
        </div>
      </div>
    </div>
  )
}
