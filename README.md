# La Vista · simulador 3D del procés de la visió

Aplicació React + Vite + TypeScript + React Three Fiber pensada per gravar un vídeo educatiu.

```bash
npm install
npm run dev
```

## Contingut
- **Ull en tall sagital** amb materials PBR i textures procedurals: escleròtica → còrnia, coroide i múscul ciliar,
  iris blau-verd amb estries, pupil·la, cristal·lí, humor aquós, humor vitri, retina (fons d'ull amb vasos),
  fòvea, punt cec i nervi òptic.
- **Raigs de llum reals** (llei de Snell, `src/optics.ts`) des d'una fletxa lluminosa ↑ fins a la retina,
  on es forma la imatge invertida i reduïda ↓. Impulsos elèctrics viatgen pel nervi òptic.
- **Miosi / Midriasi**: lliscador d'intensitat de llum.
- **Acomodació**: lliscador de distància; el múscul ciliar es contrau i el cristal·lí es corba.
- **Fotoreceptors**: zoom a la retina amb cons (L/M/S) i bastons, en mode dia o nit.
- **Trastorns**: miopia (ull llarg, focus davant), hipermetropia (ull curt, focus darrere), cataractes.
- **Mode presentació / estudi** (tecla P) i **amagar panell** (tecla H) per gravar net. Vistes de càmera predefinides.

Escala: 1 unitat = 1 cm.
