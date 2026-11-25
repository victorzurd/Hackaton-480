import { useEffect, useRef, useState } from 'react'
import logo from './assets/logo-480.svg'
import openMouth from './assets/tutor-open.svg'
import closedMouth from './assets/tutor-closed.svg'

export function AcademyBrand() {
  const [failed, setFailed] = useState(false)
  return <span className="inline-flex items-center gap-2 whitespace-nowrap">
    <span className="inline-flex h-10 items-center rounded-lg bg-[#202522] px-2.5">{failed ? <span className="text-xl font-bold text-white">480</span> : <img src={logo} onError={()=>setFailed(true)} alt="480" className="h-7 w-[69px]"/>}</span>
    <span className="text-lg font-semibold tracking-tight">Academy</span>
  </span>
}

export function TutorMascot({ size = 64 }: { size?: number }) {
  const [failed, setFailed] = useState(false)
  return <span role="img" aria-label="Mascota del tutor IA" className="relative inline-block shrink-0" style={{width:size,height:size}}>
    {failed ? <span className="flex h-full items-center justify-center rounded-xl bg-[#e9f2e3] text-xl font-bold">∞</span> : <>
      <img src={closedMouth} onError={()=>setFailed(true)} alt="" className="absolute inset-0 h-full w-full"/>
      <img src={openMouth} onError={()=>setFailed(true)} alt="" className="tutor-mouth absolute inset-0 h-full w-full"/>
    </>}
  </span>
}

export function LessonFormatDialog({ title, onClose, onContinue }: { title: string; onClose: () => void; onContinue: (format: 'lesson' | 'audio') => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [format, setFormat] = useState<'lesson'|'audio'>('lesson')
  useEffect(()=>{
    const el=dialog.current
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    el?.showModal()
    return ()=>{el?.close();document.body.style.overflow=overflow}
  },[])
  return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}} aria-labelledby="format-title" aria-describedby="format-description" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-40px)] max-w-[520px] overflow-y-auto rounded-2xl border border-[#d6e3ce] bg-[#fcfdf9] p-6 text-[#202a24] shadow-2xl backdrop:bg-[#0b1c13]/70 backdrop:backdrop-blur-sm sm:p-8">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium tracking-widest text-[#45693b]">APRENDE A TU MANERA</p><button autoFocus onClick={onClose} aria-label="Cerrar selector de formato" className="h-11 w-11 shrink-0 rounded-lg text-2xl hover:bg-[#eaf1e3]">×</button></div>
    <h2 id="format-title" className="mt-3 text-2xl font-semibold tracking-tight">¿Cómo quieres hacer la lección?</h2>
    <p id="format-description" className="mt-3 text-sm leading-6 text-[#586c4f]">{title}</p>
    <fieldset className="my-6 space-y-3"><legend className="sr-only">Formato de la lección</legend>
      {[{id:'lesson' as const,title:'Vídeo',icon:'▷',text:'Mira la lección con apoyo visual y transcripción.',badge:'Predefinido'},{id:'audio' as const,title:'Pódcast',icon:'♫',text:'Escucha la lección y consulta su transcripción.',badge:null}].map(option=><label key={option.id} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition hover:border-[#4b905a] ${format===option.id?'border-[#3b874d] bg-[#edf6e7]':'border-[#d9e2d1] bg-white'}`}>
        <input type="radio" name="lesson-format" value={option.id} checked={format===option.id} onChange={()=>setFormat(option.id)} className="h-5 w-5 shrink-0 accent-[#277644]"/>
        <span aria-hidden="true" className="text-2xl text-[#365f32]">{option.icon}</span>
        <span><span className="flex flex-wrap items-center gap-2 font-semibold">{option.title}{option.badge&&<span className="rounded bg-[#dcebd3] px-2 py-1 text-xs font-medium text-[#45613b]">{option.badge}</span>}</span><span className="mt-1 block text-sm leading-6 text-[#586c4f]">{option.text}</span></span>
      </label>)}
    </fieldset>
    <button onClick={()=>onContinue(format)} className="min-h-12 w-full rounded-lg bg-[#62f5a7] px-5 py-3 text-sm font-semibold text-[#11291d] hover:bg-[#43e995]">Empezar en formato {format==='lesson'?'vídeo':'pódcast'} →</button>
    <p className="mt-4 text-center text-sm text-[#5a6f50]">Puedes cambiar de formato durante la lección.</p>
  </dialog>
}
