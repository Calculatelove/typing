import type { CameraMode } from './camera'
import { projectWorldPoint, type CameraState, type Viewport } from './projection'
import type { PursuitState, Track, TrackDecoration, Vector2, VehicleState } from './types'
import { VEHICLE_VISUAL } from './worldConfig'

export interface RenderSceneOptions {
  readonly camera: CameraState
  readonly mode: CameraMode
  readonly pixelRatio?: number
}

export function shouldRenderDecorationNearFocus(
  decoration: TrackDecoration,
  state: PursuitState,
  mode: CameraMode,
  roadWidth: number,
): boolean {
  if (mode === 'overview' || decoration.kind !== 'building') return true
  const focus = mode === 'followThief' ? state.thief : state.police
  return Math.hypot(
    decoration.position.x - focus.worldPosition.x,
    decoration.position.y - focus.worldPosition.y,
  ) >= roadWidth * 3
}

function path(context: CanvasRenderingContext2D, points: readonly Vector2[]): void {
  context.beginPath()
  points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y))
  context.closePath()
}

function polygon(context: CanvasRenderingContext2D, points: readonly Vector2[], fill: string, stroke?: string): void {
  path(context, points)
  context.fillStyle = fill
  context.fill()
  if (stroke) { context.strokeStyle = stroke; context.stroke() }
}

function projectedTrack(track: Track, camera: CameraState, viewport: Viewport, offsetY = 0): Vector2[] {
  return track.samples.map(({ position }) => {
    const point = projectWorldPoint(position, camera, viewport)
    return { x: point.x, y: point.y + offsetY * camera.zoom }
  })
}

function drawGround(context: CanvasRenderingContext2D, viewport: Viewport, camera: CameraState): void {
  const gradient = context.createLinearGradient(0, 0, 0, viewport.height)
  gradient.addColorStop(0, '#b8d5c5'); gradient.addColorStop(1, '#8eb6a5')
  context.fillStyle = gradient; context.fillRect(0, 0, viewport.width, viewport.height)
  context.save(); context.strokeStyle = 'rgba(65,105,91,.14)'; context.lineWidth = 1
  const spacing = Math.max(90, 220 * camera.zoom)
  const shift = ((camera.position.x * camera.zoom) % spacing + spacing) % spacing
  for (let x = -spacing - shift; x < viewport.width + spacing; x += spacing) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x + viewport.height * .22, viewport.height); context.stroke()
  }
  for (let y = 0; y < viewport.height + spacing; y += spacing) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(viewport.width, y); context.stroke()
  }
  context.restore()
}

function drawRoad(context: CanvasRenderingContext2D, track: Track, camera: CameraState, viewport: Viewport): void {
  const points = projectedTrack(track, camera, viewport)
  const width = track.roadWidth * camera.zoom * .86
  context.lineCap = 'round'; context.lineJoin = 'round'
  path(context, points); context.strokeStyle = 'rgba(29,45,48,.35)'; context.lineWidth = width + 30 * camera.zoom; context.stroke()
  const lower = projectedTrack(track, camera, viewport, 12)
  path(context, lower); context.strokeStyle = '#657b78'; context.lineWidth = width + 22 * camera.zoom; context.stroke()
  path(context, points); context.strokeStyle = '#d5d5c7'; context.lineWidth = width + 18 * camera.zoom; context.stroke()
  path(context, points); context.strokeStyle = '#405059'; context.lineWidth = width; context.stroke()
  path(context, points); context.strokeStyle = 'rgba(255,255,255,.16)'; context.lineWidth = Math.max(2, 3 * camera.zoom); context.stroke()
  context.save(); context.setLineDash([24 * camera.zoom, 24 * camera.zoom]); path(context, points)
  context.strokeStyle = '#f4e6a1'; context.lineWidth = Math.max(2, 4 * camera.zoom); context.stroke(); context.restore()
}

function localWorld(anchor: Vector2, heading: number, forward: number, side: number): Vector2 {
  return {
    x: anchor.x + Math.cos(heading) * forward - Math.sin(heading) * side,
    y: anchor.y + Math.sin(heading) * forward + Math.cos(heading) * side,
  }
}

function drawBuilding(context: CanvasRenderingContext2D, decoration: TrackDecoration, camera: CameraState, viewport: Viewport): void {
  const width = (105 + decoration.variant * 14) * decoration.scale
  const depth = (78 + (decoration.variant % 2) * 22) * decoration.scale
  const height = (105 + decoration.variant * 25) * decoration.scale
  const corners = [[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([f,s]) =>
    projectWorldPoint(localWorld(decoration.position, decoration.heading, f!, s!), camera, viewport))
  const tops = [[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([f,s]) =>
    projectWorldPoint(localWorld(decoration.position, decoration.heading, f!, s!), camera, viewport, height))
  context.lineWidth = Math.max(1, camera.zoom * 2)
  polygon(context, [corners[1]!, corners[2]!, tops[2]!, tops[1]!], '#668a91', '#304d55')
  polygon(context, [corners[2]!, corners[3]!, tops[3]!, tops[2]!], '#52747c', '#304d55')
  const roofs = ['#e3a869','#b88194','#75a8a0','#9b8fc2']
  polygon(context, tops, roofs[decoration.variant % roofs.length]!, '#304d55')
  context.strokeStyle = '#d8edf0'; context.lineWidth = Math.max(1, camera.zoom * 3)
  for (const ratio of [.28,.62]) {
    context.beginPath(); context.moveTo(corners[2]!.x + (corners[1]!.x-corners[2]!.x)*ratio, corners[2]!.y + (corners[1]!.y-corners[2]!.y)*ratio)
    context.lineTo(tops[2]!.x + (tops[1]!.x-tops[2]!.x)*ratio, tops[2]!.y + (tops[1]!.y-tops[2]!.y)*ratio); context.stroke()
  }
}

function drawTree(context: CanvasRenderingContext2D, decoration: TrackDecoration, camera: CameraState, viewport: Viewport): void {
  const ground = projectWorldPoint(decoration.position, camera, viewport)
  const trunkTop = projectWorldPoint(decoration.position, camera, viewport, 58 * decoration.scale)
  context.fillStyle = 'rgba(28,53,42,.24)'; context.beginPath(); context.ellipse(ground.x+12*camera.zoom, ground.y+7*camera.zoom, 30*camera.zoom, 12*camera.zoom, .15, 0, Math.PI*2); context.fill()
  context.strokeStyle = '#684a34'; context.lineWidth = Math.max(4, 9*camera.zoom); context.beginPath(); context.moveTo(ground.x,ground.y); context.lineTo(trunkTop.x,trunkTop.y); context.stroke()
  const colors = ['#3f805d','#5b9c68','#79b36f']
  colors.forEach((color,index) => { context.fillStyle=color; context.beginPath(); context.arc(trunkTop.x+(index-1)*10*camera.zoom,trunkTop.y-index*7*camera.zoom,(24-index*3)*camera.zoom,0,Math.PI*2); context.fill() })
}

function drawLight(context: CanvasRenderingContext2D, decoration: TrackDecoration, camera: CameraState, viewport: Viewport): void {
  const base = projectWorldPoint(decoration.position,camera,viewport)
  const top = projectWorldPoint(decoration.position,camera,viewport,82)
  context.strokeStyle='#3c565d'; context.lineWidth=Math.max(2,4*camera.zoom); context.beginPath(); context.moveTo(base.x,base.y); context.lineTo(top.x,top.y); context.lineTo(top.x+14*camera.zoom,top.y); context.stroke()
  context.fillStyle='#ffe6a1'; context.beginPath(); context.arc(top.x+16*camera.zoom,top.y+2*camera.zoom,6*camera.zoom,0,Math.PI*2); context.fill()
}

function scooterPoint(vehicle: VehicleState, camera: CameraState, viewport: Viewport, forward: number, side: number, height=0): Vector2 {
  return projectWorldPoint(localWorld(vehicle.worldPosition, vehicle.heading, forward, side),camera,viewport,height)
}

function drawScooter(context: CanvasRenderingContext2D, vehicle: VehicleState, camera: CameraState, viewport: Viewport): void {
  const police = vehicle.role === 'police'; const zoom=camera.zoom
  const halfWidth = VEHICLE_VISUAL.width / 2
  const riderHeight = VEHICLE_VISUAL.riderHeight
  const back=scooterPoint(vehicle,camera,viewport,-VEHICLE_VISUAL.length/2,0)
  const front=scooterPoint(vehicle,camera,viewport,VEHICLE_VISUAL.length/2,0)
  context.strokeStyle='rgba(16,29,32,.28)'; context.lineWidth=18*zoom; context.beginPath(); context.moveTo(back.x+9*zoom,back.y+10*zoom); context.lineTo(front.x+9*zoom,front.y+10*zoom); context.stroke()
  context.fillStyle='#17242a'; for(const wheel of [back,front]){context.beginPath();context.ellipse(wheel.x,wheel.y,12*zoom,7*zoom,0,0,Math.PI*2);context.fill()}
  const deckL=scooterPoint(vehicle,camera,viewport,-24,-halfWidth,10), deckR=scooterPoint(vehicle,camera,viewport,25,-halfWidth,10)
  const deckR2=scooterPoint(vehicle,camera,viewport,25,halfWidth,10), deckL2=scooterPoint(vehicle,camera,viewport,-24,halfWidth,10)
  polygon(context,[deckL,deckR,deckR2,deckL2],police?'#39a8cf':'#e47a45','#18343e')
  const stem=scooterPoint(vehicle,camera,viewport,29,0,52); context.strokeStyle=police?'#d7f4fb':'#7a4b85';context.lineWidth=5*zoom;context.beginPath();context.moveTo(front.x,front.y);context.lineTo(stem.x,stem.y);context.stroke()
  const feet=scooterPoint(vehicle,camera,viewport,-5,0,riderHeight * .22), body=scooterPoint(vehicle,camera,viewport,-7,0,riderHeight * .78), head=scooterPoint(vehicle,camera,viewport,-7,0,riderHeight + 10)
  context.strokeStyle=police?'#173e63':'#463047'; context.lineWidth=10*zoom; context.beginPath();context.moveTo(feet.x,feet.y);context.lineTo(body.x,body.y);context.lineTo(stem.x,stem.y);context.stroke()
  context.fillStyle=police?'#e8f5f7':'#d39b77';context.beginPath();context.arc(head.x,head.y,10*zoom,0,Math.PI*2);context.fill()
  context.fillStyle=police?'#246d9c':'#5d3a67';context.beginPath();context.arc(head.x-2*zoom,head.y-4*zoom,11*zoom,Math.PI,Math.PI*2);context.fill()
  if(police){context.fillStyle='#ef6570';context.fillRect(body.x-8*zoom,body.y-8*zoom,7*zoom,5*zoom);context.fillStyle='#62d4eb';context.fillRect(body.x,body.y-8*zoom,7*zoom,5*zoom)}
  else { const pack=scooterPoint(vehicle,camera,viewport,-13,8,60);context.fillStyle='#8c5b3f';context.beginPath();context.arc(pack.x,pack.y,10*zoom,0,Math.PI*2);context.fill() }
}

export function renderDebugScene(context: CanvasRenderingContext2D, track: Track, state: PursuitState, viewport: Viewport, options: RenderSceneOptions): void {
  const pixelRatio = options.pixelRatio ?? 1
  context.setTransform(1,0,0,1,0,0)
  context.clearRect(0,0,viewport.width * pixelRatio,viewport.height * pixelRatio)
  context.setTransform(pixelRatio,0,0,pixelRatio,0,0)
  drawGround(context,viewport,options.camera);drawRoad(context,track,options.camera,viewport)
  const items: {depth:number;draw:()=>void}[] = []
  for(const decoration of track.decorations){const point=projectWorldPoint(decoration.position,options.camera,viewport);if(shouldRenderDecorationNearFocus(decoration,state,options.mode,track.roadWidth)&&(options.mode==='overview'||(point.x>-300&&point.x<viewport.width+300&&point.y>-350&&point.y<viewport.height+300)))items.push({depth:point.y,draw:()=>decoration.kind==='building'?drawBuilding(context,decoration,options.camera,viewport):decoration.kind==='tree'?drawTree(context,decoration,options.camera,viewport):drawLight(context,decoration,options.camera,viewport)})}
  for(const vehicle of [state.police,state.thief]){const point=projectWorldPoint(vehicle.worldPosition,options.camera,viewport);items.push({depth:point.y,draw:()=>drawScooter(context,vehicle,options.camera,viewport)})}
  items.sort((a,b)=>a.depth-b.depth).forEach((item)=>item.draw())
}
