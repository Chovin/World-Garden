// let cloudImg
// function preload() {
//   cloudImg = loadImage('assets/cloud2.png')
// }

// doesn't work in ios safari
if (screen && screen.lockOrientation) {
  screen.lockOrientation('portrait');  
}

let onMobile = mobileCheck()
let latlng;
let center;
let geoLoaded;
let newCenter;
let camLerpSpd;
let maxCamLerpSpd = 0.01
let camLerpAccel = 0.01
let randomCamMovementFeet = 50
let centerTile = [0, 0]
let prevCenterTile = [...centerTile]

let grassResolution = 5
let grassFiles = [
    'assets/grass1.png',
    // 'assets/grass2.png',
    'assets/tallgrass.png'
  ]
let grassImages = []
let zBuffer = []

function setupGeoLocation() {
  function setGeoCenter(geo) {
    latlng = [geo.coords.latitude, geo.coords.longitude]
    // random movement
    latlng = [latlng[0]+Math.sin(Math.random()*2*PI)*randomCamMovementFeet/feetPerLat,latlng[1]+Math.sin(Math.random()*2*PI)*randomCamMovementFeet/feetPerLon]
    newCenter = latLngToTile(latlng)
    camLerpSpd = 0

    centerTile = [~~newCenter[0], ~~newCenter[1]]
    if (prevCenterTile[0] != centerTile[0] || prevCenterTile[1] != centerTile[1]) {
      prevCenterTile = [...centerTile]
      document.dispatchEvent(new Event('centerTileChanged'))
    }
  }
  navigator.geolocation.getCurrentPosition((geo) => {
    setGeoCenter(geo)
    center = [...newCenter]
    geoLoaded = true
    navigator.geolocation.watchPosition((geo) => {
      setGeoCenter(geo)
    })
  }, (e) => {
    alert(e.message)
  })
}

function updateGrassTiles() {
  let toKeep = {}
  let mxgr = cw*1/grassResolution*2.5
  let mngr = cw*1/grassResolution*.075
  let mxgshift = cw*1/grassResolution*2
  let grassNoiseZoom = 10
  let grassDensity = .4
  let tuffDensity = 10
  
    
  for(let x=-hc; x<=hc; x++) {
    for(let y=-hc; y<=hc; y++) {
      // cheap distance
      if (x*x + y*y > squared_horizon_dist) {
        continue
      }
      let cx = centerTile[0] + x
      let cy = centerTile[1] + y
      let cxcy = cx+'/'+cy
      toKeep[cxcy] = true
      if (grassPatches[cxcy]) {
        continue
      }
      let patch = []
      let hres = 1/grassResolution/2
      for (let mx=0; mx<grassResolution;mx++) {
        let ox = hres + mx/grassResolution
        for (let my=0; my<grassResolution;my++) {
          let oy = hres + my/grassResolution
          let hasGrass = noise((cx+ox+2000)*grassNoiseZoom*.4,(cy+oy+2000)*grassNoiseZoom*.4) < grassDensity
          if (!hasGrass) {
            continue
          }
          let rn = noise((cx+ox)*grassNoiseZoom,(cy+oy)*grassNoiseZoom)
          let r = rn*(mxgr-mngr)+mngr
          let nTuffs = rn*tuffDensity*((noise((cx+ox+1000)*grassNoiseZoom*1.2,(cy+oy+1000)*grassNoiseZoom*1.2)-1)*1.6 + 1)
          let tuffs = []
          for (let ti=0; ti<nTuffs;ti++) {
            tuffs.push({
              x: (noise((cx+ox+4000+ti)*grassNoiseZoom*.1,(cy+oy+4000+ti)*grassNoiseZoom*.1)*2-1)*r*.7,
              y: (noise((cx+ox+4300+ti)*grassNoiseZoom*.08,(cy+oy+4300+ti)*grassNoiseZoom*.08)*2-1)*r*.7,
              img: grassImages[~~(noise((cx+ox+3500)*grassNoiseZoom*.08,(cy+oy+3500)*grassNoiseZoom*.08)*grassImages.length)]
            })
          }
          patch.push({
            x: ox*cw + (noise((cx+ox+4000)*grassNoiseZoom*.4,(cy+oy+4000)*grassNoiseZoom*.4)*2-1)*mxgshift,
            y: oy*cw + (noise((cx+ox+5000)*grassNoiseZoom*.7,(cy+oy+5000)*grassNoiseZoom*.7)*2-1)*mxgshift,
            z: .01+noise((cx+ox+3000)*grassNoiseZoom*2,(cy+oy+3000)*grassNoiseZoom*2)*.15,
            r,
            gi: grassImages[~~(Math.random()*grassImages.length)],
            tuffs
          })
        }
      }
      grassPatches[cxcy] = patch
    }
  }
  
  // delete unused grass
  for (let key in grassPatches) {
    if (toKeep[key]) {
      continue
    }
    delete grassPatches[key]
  }
}

function preload() {
  for (let gf of grassFiles) {
    grassImages.push(loadImage(gf))
  }
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  gl = canvas.GL;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  setAttributes('alpha', true);
  noiseSeed(10273)
  moveCloser = 30
  moveHeight = 480
  drawSky = true
  moveTilt = 1 // .97
  t = 0
  cols = 9
  hc = ~~(cols/2)
  cw = 170
  range = cw*.8
  zoomlvl = 18
  squared_horizon_dist = hc*hc*1.25
  geoLoaded = false
  centerTile = [0, 0]
  prevCenterTile = [...centerTile]
  if (onMobile) {
    setupGeoLocation()
  } else {
    latlng = [13.505193, 144.785739]
    newCenter = latLngToTile(latlng)
    center = newCenter
    geoLoaded = true
  }
  centerm = [windowWidth/2, windowHeight*.8]
  loadingImages = {}

  apikey = '34327c31ec0a4c34ae6cc465ae534965'
  apilayer = 'neighbourhood'
  apibase = `tile.thunderforest.com/${apilayer}/${zoomlvl}`
  zRot = 0
  zSpd = 0.02
  spd = 0.01
  noStroke()
  background(185,228,253)
  gpsset = false

  startTouch = [0,0]

  feetPerLat = 288200
  feetPerLon = 364000

  grassPatches = {}

  document.addEventListener('centerTileChanged', updateGrassTiles)
}

function draw() {
  if (!geoLoaded) {
    background(185,228,253)
    return
  }
  // load images every so often
  if (t%30 == 0) {
    let servers = ['a','b','c']
    let ccx = ~~center[0]
    let ccy = ~~center[1]
    for(let x=-hc; x<=hc; x++) {
      for(let y=-hc; y<=hc; y++) {
        let cx = ccx+x
        let cy = ccy+y
        let xx=x+hc
        let yy=y+hc
        let cxcy = cx+'/'+cy
        if (loadingImages[cxcy]) {
          continue
        }
        let server = servers[(xx+yy*cols)%servers.length]
        let url = `https://${server}.${apibase}/${cxcy}.png?apikey=${apikey}`
        loadingImages[cxcy] = loadImage(url, (img) => {
          img.loaded = true
        }, (
          (ecxcy) => {
            return () => {
            // delete to be loaded again later
              delete loadingImages[ecxcy]
            }
          }
        )(cxcy))
      }
    }
  }
  
  t += 1
  
  // camera lerp
  if (camLerpSpd < maxCamLerpSpd*.995) {
    camLerpSpd = lerp(camLerpSpd, maxCamLerpSpd, camLerpAccel)
  }
  if (newCenter[0]-center[0] > 1/256/3) {
    center[0] = lerp(center[0],newCenter[0],camLerpSpd)
  }
  if (newCenter[1]-center[1] > 1/256/3) {
    center[1] = lerp(center[1],newCenter[1],camLerpSpd)
  }
  
  // non-touch rotation
  if (keyIsPressed) {
    let left = keyIsDown(LEFT_ARROW)
    let right = keyIsDown(RIGHT_ARROW)
    // xor
    if (left ^ right) {
      zRot += zSpd * (left?1:-1)
    }
    let forward = keyIsDown(UP_ARROW)
    let backward = keyIsDown(DOWN_ARROW)
    if (forward ^ backward) {
      let dir = forward ? 1 : -1
      center[0] += -sin(zRot)*spd*dir
      center[1] += -cos(zRot)*spd*dir
    }
    if (keyCode == BACKSPACE && gpsset==false) {
      gpsset = true
      console.log(tileToLatLng([...center]))
    }
  }
  
  // sky
  if (drawSky) {
    let shy = sin(t/100)*10
    translate(0,0,moveHeight)
    push()
    translate(0,-cw*.95,-120+shy)
    fill(230,240,253,30)
    plane(windowWidth,80) 
    fill(200,220,240,10)
    plane(windowWidth,100)
    pop()
  }
  
  // move closer
  translate(0,moveCloser,0)
  rotateX(moveTilt)
  let ox = (center[0]%1+.3)*cw
  let oy = (center[1]%1-.9)*cw

  // world
  push()
  rotateZ(zRot)
  // stroke(0)
  let ccx = ~~center[0]
  let ccy = ~~center[1]
  for(let x=-hc; x<=hc; x++) {
    for(let y=-hc; y<=hc; y++) {
      // cheap distance
      if (x*x + y*y > squared_horizon_dist) {
        continue
      }
      let cx=x+ccx
      let cy=y+ccy
      let cxcy = cx+'/'+cy
      let tx = (x-center[0]%1+.5)*cw
      let ty = (y-center[1]%1+.5)*cw
      // let tx = (x)*cw
      // let ty = (y)*cw
      push()
      translate(tx,ty,0)
      let tex = loadingImages[cxcy]
      if (tex && tex.loaded) {
        texture(tex)
      } else {
        fill(238,245,249)
      }
      plane(cw)
      
      pop()
    }
  }

  // undo rotation  
  pop()

  // player
  push()
  fill(255)
  translate(0,0,2+sin(t/20)*2)
  rotateX(-PI/4)
  scale(.7,1,1)
  rotateZ(PI/4)
  box(5)
  pop()
    
  push()
  noFill()
  rotateZ(zRot)
  rotateZ(t/240)
  stroke(150,150,150,150)
  circle(0,0,range)
  stroke(250,250,200,250)
  translate(0,0,3+sin(t/30))
  circle(0,0,range)

  // noStroke()
  // fill(250,250,150,100)
  // circle(10,0,range/3)
  // translate(0,0,0.01)
  // circle(0,0,range/3)
  pop()

  push()
  rotateZ(zRot)
  
  // grass
  fill(100,250,120,100)

  // texture(grassImages[0])
  // plane(100)
  
  for(let x=-hc; x<=hc; x++) {
    for(let y=-hc; y<=hc; y++) {
      // cheap distance
      if (x*x + y*y > squared_horizon_dist) {
        continue
      }
      let cx=x+ccx
      let cy=y+ccy
      let cxcy = cx+'/'+cy
      let tx = (x-center[0]%1)*cw
      let ty = (y-center[1]%1)*cw
      // let tx = (x)*cw
      // let ty = (y)*cw
      let grass = grassPatches[cxcy]
      if (!grass) {
        continue
      }
      push()
      translate(tx,ty,0)
      for (let g of grass) {
        push()
        translate(g.x,g.y,g.z)
        // scale(1,1,.1)
        circle(0,0,g.r)
        fill(0,0,0,0)
        texture(g.gi)
        // stroke(0)
        let w = 10
        translate(0,0,w/2)
        for (let tuff of g.tuffs) {
        // if (g.tuffs[0]) {
          push()
          translate(tuff.x, tuff.y, 0)
          texture(tuff.img)
          rotateZ(-zRot)
          rotateX(-PI/2)
          plane(w)
          pop()
        // }
        }
        // sphere(g.r/2)
        pop()
      }
      pop()
    }
  }
  pop()
  
}

// center on box
function touchStarted() {
  startTouch = [atan2(mouseY-centerm[1], mouseX-centerm[0]), zRot]
  return false
}

function touchMoved(e) {
  zRot = startTouch[1] + atan2(mouseY-centerm[1], mouseX-centerm[0]) - startTouch[0]
  return false
}