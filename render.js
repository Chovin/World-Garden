import * as THREE from 'three';
import IntervalScheduler from 'intervalScheduler'
import mobileCheck from 'mobileCheck'
import {latLngToTile, tileToLatLng} from 'projection'

const onMobile = mobileCheck()

let center = [0,0]
let centerTile = [0, 0]
let prevCenterTile = [...centerTile]

const zoomlvl = 18

const cols = 11
const hc = ~~(cols/2)
const cw = 170

const apikey = '34327c31ec0a4c34ae6cc465ae534965'
const apilayer = 'neighbourhood'
const apibase = `tile.thunderforest.com/${apilayer}/${zoomlvl}`

let loadingMapTextures = {}

let range = cw*.8
let squared_horizon_dist = hc*hc*1.25

let newCenter = [...center]
let geoLoaded = false

let camLerpSpd;
let maxCamLerpSpd = 0.01
let camLerpAccel = 0.01
let randomCamMovementFeet = 50

let latlng = [0,0]
let zRot = 0
const zSpd = 0.02
const spd = 0.01

let feetPerLat = 288200
let feetPerLon = 364000

const startTouch = [0,0]

const groundTiles = {}

if (onMobile) {
  setupGeoLocation()
} else {
  latlng = [13.505193, 144.785739]
  newCenter = latLngToTile(latlng, zoomlvl)
  center = [...newCenter]
  geoLoaded = true
}

const canvas = document.getElementById('c');
let centerm;
function resetCenterm() {
  centerm = [canvas.clientWidth/2, canvas.clientHeight*.65]
}
resetCenterm()


function loadMapTextures() {
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "Anonymous"
  
  let servers = ['a','b','c']
  let ccx = ~~center[0]
  let ccy = ~~center[1]
  let toKeep = {}
  for(let x=-hc; x<=hc; x++) {
    for(let y=-hc; y<=hc; y++) {
      let cx = ccx+x
      let cy = ccy+y
      let xx=x+hc
      let yy=y+hc
      let cxcy = cx+'/'+cy
      toKeep[cxcy] = true
      if (loadingMapTextures[cxcy]) {
        continue
      }
      let server = servers[(xx+yy*cols)%servers.length]
      let url = `https://${server}.${apibase}/${cxcy}.png?apikey=${apikey}`
      loadingMapTextures[cxcy] = loader.load(url, (texture) => {
        texture.loaded = true
      }, (
        (ecxcy) => {
          return () => {
          // delete to be loaded again later
            loadingMapTextures[ecxcy].dispose()
            delete loadingMapTextures[ecxcy]
          }
        }
      )(cxcy))
    }
  }
  for (let cxcy of Object.keys(loadingMapTextures)) {
    if (!toKeep[cxcy]) {
      loadingMapTextures[cxcy].dispose()
      delete loadingMapTextures[cxcy]
    }
  }
}

function texturizeMapTiles() {
  let ccx = ~~center[0]
  let ccy = ~~center[1]
  for (let x=-hc; x<=hc; x++) {
    for (let y=-hc; y<=hc; y++) {
      if (x*x + y*y > squared_horizon_dist) {
        continue
      }
      let cx = ccx+x
      let cy = ccy+y
      let cxcy = cx+'/'+cy
      let tex = loadingMapTextures[cxcy]
      groundTiles[x][y].material.map = tex
    }
  }
}
function setupGeoLocation() {
  function setGeoCenter(geo) {
    latlng = [geo.coords.latitude, geo.coords.longitude]
    // random movement
    latlng = [latlng[0]+Math.sin(Math.random()*2*Math.PI)*randomCamMovementFeet/feetPerLat,latlng[1]+Math.sin(Math.random()*2*Math.PI)*randomCamMovementFeet/feetPerLon]

    newCenter = latLngToTile(latlng, zoomlvl)
    camLerpSpd = 0

    // lerp later
    center = [...newCenter]
    
    centerTile = [~~newCenter[0], ~~newCenter[1]]
    if (prevCenterTile[0] != centerTile[0] || prevCenterTile[1] != centerTile[1]) {
      prevCenterTile = [...centerTile]
      document.dispatchEvent(new Event('centerTileChanged'))
      loadMapTextures()
      texturizeMapTiles()
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

// handle key presses
const keysDown = {}
document.addEventListener("keydown", (e) => {
  let keyCode = e.code
  keysDown[keyCode] = true
}, false)
document.addEventListener("keyup", (e) => {
  let keyCode = e.code
  keysDown[keyCode] = false
}, false)


function main() {
  const renderer = new THREE.WebGLRenderer({antialias: true, canvas})

  let t = 0

  const loadTextureScheduler = new IntervalScheduler(1000, loadMapTextures)
  loadTextureScheduler.start()
  
  const fov = 75;
  const aspect = 2;
  const near = 0.1;
  const far = hc+1;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  const camDist = .5;
  camera.position.z = camDist;
  camera.position.y = camDist*1.25

  const scene = new THREE.Scene();

  const boxWidth = 1
  const boxHeight = 1
  const boxDepth = 1
  const planeGeo = new THREE.PlaneGeometry(boxWidth, boxHeight)

  function makeInstance(geometry, tex, x, z) {
    const material = new THREE.MeshBasicMaterial({map: tex});
  
    const plane = new THREE.Mesh(geometry, material);

    plane.position.z = z
    plane.position.x = x
    plane.rotation.x = -Math.PI/2;
  
    return plane;
  }

  const colors = [
    0x44aa88, 0x4488aa, 0xaa8844
  ]

  // light
  const color = 0xFFFFFF;
  const intensity = 3;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(-1,2,4)
  scene.add(light);

  // document.addEventListener('centerTileChanged', updateGrassTiles)
  // document.addEventListener('centerTileChanged', updateGrassTiles)

  loadMapTextures()
  
  // generate tiles
  const worldGroup = new THREE.Group()

  let ccx = ~~center[0]
  let ccy = ~~center[1]
  for (let x=-hc; x<=hc; x++) {
    groundTiles[x] = {}
    for (let y=-hc; y<=hc; y++) {
      if (x*x + y*y > squared_horizon_dist) {
        continue
      }
      let cx = ccx+x
      let cy = ccy+y
      let cxcy = cx+'/'+cy
      let tex = loadingMapTextures[cxcy]
      groundTiles[x][y] = makeInstance(planeGeo, tex, x, y)
      worldGroup.add(groundTiles[x][y])
    }
  }
  scene.add(worldGroup)

  let skyColor = 0x47aFff
  // fog
  scene.fog = new THREE.Fog( 0xffffff, hc-2, hc-.75 );

  // sky
  scene.background = new THREE.Color(skyColor)
  // sky plane
  const skyMat = new THREE.MeshBasicMaterial({color: skyColor});
  const skyGeo = new THREE.PlaneGeometry(10, 10)
  const skyMesh = new THREE.Mesh(skyGeo, skyMat)
  scene.add(skyMesh)
  
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  // camera.lookAt(0,-.25,0)

  // player
  const playerGeo = new THREE.SphereGeometry(.05, 32, 32)
  const playerMat = new THREE.MeshBasicMaterial({color: 0xffffff})
  const player = new THREE.Mesh(playerGeo, playerMat)
  player.position.set(0, .025, 0)
  scene.add(player)

  // ring
  const ringGeo = new THREE.TorusGeometry(.65, .005, 5, 28)
  const ringMat = new THREE.MeshBasicMaterial({color: 0xffffaa})
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI/2
  ring.position.z = .0
  scene.add(ring)
  const ringShadowMat = new THREE.MeshBasicMaterial({color: 0xaaaaaa})
  const ringShadow = new THREE.Mesh(ringGeo, ringShadowMat)
  ringShadow.rotation.x = -Math.PI/2
  ringShadow.position.y = .0
  scene.add(ringShadow)


  // render
  function render(time) {
    time *=0.001
    t += 1

    // non-touch movement
    if (!onMobile) {
      let left = keysDown['ArrowLeft']
      let right = keysDown['ArrowRight']
      // xor
      if (left ^ right) {
        zRot += zSpd * (left?1:-1)
      }
      let forward = keysDown['ArrowUp']
      let backward = keysDown['ArrowDown']
      
      if (forward ^ backward) {
        let dir = forward ? 1 : -1
        center[0] += -Math.sin(zRot)*spd*dir
        center[1] += -Math.cos(zRot)*spd*dir
      }
      centerTile = [~~(center[0]), ~~(center[1])]
      if (centerTile[0] != prevCenterTile[0] || centerTile[1] != prevCenterTile[1]) {
        document.dispatchEvent(new Event('centerTileChanged'))
        prevCenterTile = [...centerTile]
        loadMapTextures()
        texturizeMapTiles()
      }
    }
    

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth/canvas.clientHeight;
      camera.updateProjectionMatrix();
      resetCenterm()
    }
    skyMesh.rotation.y = zRot
    skyMesh.position.x = -Math.sin(zRot)*(hc-1)
    skyMesh.position.z = -Math.cos(zRot)*(hc-1)
    camera.position.x = Math.sin(zRot)*camDist
    camera.position.z = Math.cos(zRot)*camDist
    worldGroup.position.x = -(center[0])%1+.5
    worldGroup.position.z = -(center[1])%1+.5
    
    camera.lookAt(0,camDist/2.5,0)

    ring.position.y = Math.sin(time)*.02+.05
    ring.rotation.z = time + zRot
    ringShadow.rotation.z = time + zRot
    
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render)
}


document.addEventListener('touchstart', touchStarted)
document.addEventListener('touchmove', touchMoved)


function touchStarted(e) {
  let mouseY = e.touches[0].clientY
  let mouseX = e.touches[0].clientX
  startTouch[0] = Math.atan2(mouseY-centerm[1], mouseX-centerm[0])
  startTouch[1] = zRot
  return false
}

function touchMoved(e) {
  let mouseY = e.touches[0].clientY
  let mouseX = e.touches[0].clientX
  zRot = startTouch[1] + Math.atan2(mouseY-centerm[1], mouseX-centerm[0]) - startTouch[0]
  return false
}


main()

