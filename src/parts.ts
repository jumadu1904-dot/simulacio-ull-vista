export type PartId =
  | 'sclera'
  | 'cornea'
  | 'choroid'
  | 'ciliary'
  | 'iris'
  | 'pupil'
  | 'lens'
  | 'aqueous'
  | 'vitreous'
  | 'retina'
  | 'fovea'
  | 'blindspot'
  | 'nerve'
  | 'object'
  | 'image'

export const PARTS: Record<PartId, { name: string; desc: string }> = {
  sclera: {
    name: 'Escleròtica',
    desc: "Capa externa blanca, dura i resistent. Protegeix l'ull i a la part davantera es transforma en la còrnia.",
  },
  cornea: {
    name: 'Còrnia',
    desc: "Part transparent i bombada de l'escleròtica. És la primera lent de l'ull i la que més desvia la llum.",
  },
  choroid: {
    name: 'Coroide',
    desc: 'Capa intermèdia fosca i molt irrigada: nodreix la retina i absorbeix la llum sobrant.',
  },
  ciliary: {
    name: 'Múscul ciliar',
    desc: "Continuació de la coroide. Quan es contrau, els lligaments s'afluixen i el cristal·lí es corba (acomodació).",
  },
  iris: {
    name: 'Iris',
    desc: "Múscul anul·lar pigmentat que dona color a l'ull. Regula la mida de la pupil·la.",
  },
  pupil: {
    name: 'Pupil·la',
    desc: "Forat central de l'iris per on entra la llum. Molta llum → miosi (es tanca). Poca llum → midriasi (s'obre).",
  },
  lens: {
    name: 'Cristal·lí',
    desc: 'Lent biconvexa, transparent i elàstica situada darrere l\'iris. Canvia de forma per enfocar.',
  },
  aqueous: {
    name: 'Humor aquós',
    desc: 'Líquid transparent entre la còrnia i el cristal·lí. Nodreix la còrnia i manté la pressió de l\'ull.',
  },
  vitreous: {
    name: 'Humor vitri',
    desc: "Massa gelatinosa i transparent que omple l'ull i en manté la forma esfèrica.",
  },
  retina: {
    name: 'Retina',
    desc: 'Capa interna sensible a la llum, amb cons i bastons, que transforma la llum en impulsos nerviosos.',
  },
  fovea: {
    name: 'Fòvea',
    desc: 'Zona central de la retina, davant la pupil·la, amb la màxima densitat de cons: visió més nítida.',
  },
  blindspot: {
    name: 'Punt cec',
    desc: "Lloc on neix el nervi òptic. No hi ha fotoreceptors, per tant no s'hi veu res.",
  },
  nerve: {
    name: 'Nervi òptic',
    desc: 'Porta els impulsos elèctrics de la retina fins al cervell, on s\'interpreta la imatge.',
  },
  object: {
    name: 'Objecte',
    desc: "Fletxa lluminosa cap amunt. Els raigs grocs surten de la punta i els blaus de la base.",
  },
  image: {
    name: 'Imatge a la retina',
    desc: 'Real, invertida (↓) i més petita que l\'objecte. El cervell la torna a girar.',
  },
}
