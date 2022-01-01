import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import Stats from "https://threejs.org/examples/jsm/libs/stats.module.js";
import { RGBELoader } from "https://threejs.org/examples/jsm/loaders/RGBELoader.js";
// import { GUI } from "https://threejs.org/examples/jsm/libs/dat.gui.module.js";
import { GUI } from "https://threejs.org/examples/jsm/libs/lil-gui.module.min.js";

import { GLTFLoader } from "https://threejs.org/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "https://threejs.org/examples/jsm/loaders/OBJLoader.js";
import { RoughnessMipmapper } from "https://threejs.org/examples/jsm/utils/RoughnessMipmapper.js";

let scene, camera, renderer;

let controls, stats;

let hemiLight, dirLight;

let analyser, dataArray, audio;
const songDict = [
  "Bebe Rexha - Meant to Be.mp3",
  "Jason_Mraz_-_Im_Yours.mp3",
  "Martin Garrix - In The Name of Love.mp3",
  "KSHMR - House Of Cards.mp3",
  "Avicii - Levels.mp3",
  "Clean Bandit - Rather Be.mp3",
  "Ed Sheeran - Perfect.flac",
  "Ed Sheeran - Shape of You.flac",
];
const paramsAudio = {
  fftSize: 2048,
  songDir: "./sounds/",
  songName: songDict[1],
};

let mesh,
  material,
  glass_material,
  originalGeometry,
  displacementMagnitude,
  numDeformLevel = 25; // for mesh deformation
const paramsMeshMaterial = {
  color: 0x6c98,
  transmission: 0,
  opacity: 1,
  metalness: 1,
  roughness: 0,
  ior: 1.5,
  thickness: 0.01,
  specularIntensity: 1,
  specularColor: 0xffffff,
  envMapIntensity: 1,
  lightIntensity: 1,
  exposure: 1,
};
const paramsDeform = {
  amplitude: 5,
  resolution: 25,
  deformMode: "slicing",
};

let tetrahGroup = [],
  num_tetrah = 100,
  octahGroup = [],
  num_octah = 100;
const paramsGlassMaterial = {
  color: 0x1b00ef,
  transmission: 1,
  opacity: 1,
  metalness: 0,
  roughness: 0,
  ior: 2,
  thickness: 5,
  specularIntensity: 1,
  specularColor: 0xffffff,
  envMapIntensity: 1,
  lightIntensity: 1,
  exposure: 1,
};

// start button
const startButton = document.getElementById("startButton");
startButton.addEventListener("click", init);

function init() {
  document.getElementById("overlay").remove(); // remove the start button

  // scene
  scene = new THREE.Scene();

  initRender();
  // initGrid();
  initStatsBar();
  initGUI();
  initCameraAndMouseControl();
  initLight();
  initBackground("sepulchral_chapel_rotunda_4k.hdr");

  loadAndAnalyzeAudio(
    paramsAudio.songDir + paramsAudio.songName,
    paramsAudio.fftSize
  );

  createModel();
  createGlassObjectGroup();

  audio.play();

  animate();
}

function getRandom(min, max) {
  return (max - min) * Math.random() + min;
}

function initRender() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  renderer.setPixelRatio(window.devicePixelRatio); // water
}

function initStatsBar() {
  stats = new Stats();
  stats.showPanel(1);
  document.body.appendChild(stats.dom);
}

function initGUI() {
  const gui = new GUI();

  gui
    .add(paramsAudio, "songName", songDict)
    .name("Song")
    .onChange(function () {
      audio.pause();
      loadAndAnalyzeAudio(
        paramsAudio.songDir + paramsAudio.songName,
        paramsAudio.fftSize
      );
      audio.play();
    });

  const folderMotion = gui.addFolder("Motion");
  folderMotion
    .add(paramsDeform, "deformMode", ["slicing", "polar"])
    .name("Motion mode")
    .onChange(function () {
      meshDeformInit(numDeformLevel);
    });
  folderMotion.add(paramsDeform, "resolution", 4, 512, 1).onChange(function () {
    numDeformLevel = paramsDeform.resolution;
    meshDeformInit(numDeformLevel);
  });
  folderMotion
    .add(paramsDeform, "amplitude", 1, 20, 1)
    .onChange(function () {});

  folderMotion.open();

  // mesh appearance GUI
  const folderMesh = gui.addFolder("Mesh Appearance");
  folderMesh.addColor(paramsMeshMaterial, "color").onChange(function () {
    material.color.set(paramsMeshMaterial.color);
  });

  folderMesh
    .add(paramsMeshMaterial, "transmission", 0, 1, 0.01)
    .onChange(function () {
      material.transmission = paramsMeshMaterial.transmission;
    });

  folderMesh
    .add(paramsMeshMaterial, "opacity", 0, 1, 0.01)
    .onChange(function () {
      material.opacity = paramsMeshMaterial.opacity;
    });

  folderMesh
    .add(paramsMeshMaterial, "metalness", 0, 1, 0.01)
    .onChange(function () {
      material.metalness = paramsMeshMaterial.metalness;
    });

  folderMesh
    .add(paramsMeshMaterial, "roughness", 0, 1, 0.01)
    .onChange(function () {
      material.roughness = paramsMeshMaterial.roughness;
    });

  folderMesh
    .add(paramsMeshMaterial, "thickness", 0, 5, 0.01)
    .onChange(function () {
      material.thickness = paramsMeshMaterial.thickness;
    });

  // glass material gui
  const folderGlass = gui.addFolder("Glass Appearance");
  folderGlass.addColor(paramsGlassMaterial, "color").onChange(function () {
    glass_material.color.set(paramsGlassMaterial.color);
  });

  folderGlass
    .add(paramsGlassMaterial, "transmission", 0, 1, 0.01)
    .onChange(function () {
      glass_material.transmission = paramsGlassMaterial.transmission;
    });

  folderGlass
    .add(paramsGlassMaterial, "opacity", 0, 1, 0.01)
    .onChange(function () {
      glass_material.opacity = paramsGlassMaterial.opacity;
    });

  folderGlass
    .add(paramsGlassMaterial, "metalness", 0, 1, 0.01)
    .onChange(function () {
      glass_material.metalness = paramsGlassMaterial.metalness;
    });

  folderGlass
    .add(paramsGlassMaterial, "roughness", 0, 1, 0.01)
    .onChange(function () {
      glass_material.roughness = paramsGlassMaterial.roughness;
    });

  folderGlass
    .add(paramsGlassMaterial, "thickness", 0, 5, 0.01)
    .onChange(function () {
      glass_material.thickness = paramsGlassMaterial.thickness;
    });
}

function initCameraAndMouseControl() {
  // camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 8, 50);

  // mouse control
  controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener("change", render); // use if there is no animation loop
  controls.target.set(0, 0, -0.2);

  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.5;
  controls.enableDamping = true;

  window.addEventListener("resize", onWindowResize);
}

function initGrid() {
  const size = 10;
  const divisions = 10;
  const gridHelper = new THREE.GridHelper(size, divisions);
  scene.add(gridHelper);
}

function initLight() {
  // hemiLight
  hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
  hemiLight.color.setHSL(0.6, 1, 0.6);
  hemiLight.groundColor.setHSL(0.095, 1, 0.75);
  hemiLight.position.set(0, 500, 0);
  scene.add(hemiLight);

  // dirLight
  dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(-1, 1.75, 1);
  dirLight.position.multiplyScalar(50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  var d = 50;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.far = 3500;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);

  let pointlight1 = new THREE.PointLight(0xffffff, 1); // color, intensity, distance, decay
  pointlight1.position.set(2, 2, 2);
  scene.add(pointlight1);
  let pointlight2 = new THREE.PointLight(0xfb11111, 5);
  pointlight2.position.set(-2, 2, 2);
  scene.add(pointlight2);
}

function initBackground(texture) {
  new RGBELoader()
    .setPath("./textures/hdri/")
    .load(texture, function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;

      scene.background = texture;
      scene.environment = texture;
    });
}

// create the main mesh with basic THREE.js geometry
function createModel() {
  const geometry = new THREE.SphereGeometry(5, 1024, 1024);
  const texture = new THREE.CanvasTexture(generateTexture());
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat = (10, 6);

  material = meshMaterial();

  mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, 0);
  scene.add(mesh);
  originalGeometry = mesh.geometry.clone();
  meshDeformInit(numDeformLevel);
}

function meshMaterial() {
  var newMaterial = new THREE.MeshPhysicalMaterial({
    color: paramsMeshMaterial.color,
    metalness: paramsMeshMaterial.metalness,
    roughness: paramsMeshMaterial.roughness,
    ior: paramsMeshMaterial.ior,
    transmission: paramsMeshMaterial.transmission, // use material.transmission for glass materials
    specularIntensity: paramsMeshMaterial.specularIntensity,
    specularColor: paramsMeshMaterial.specularColor,
    opacity: paramsMeshMaterial.opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
  return newMaterial;
}

// create small objects in the background
function createGlassObjectGroup() {
  glass_material = glassMaterial();

  var radius = 200;
  var vacuum = 30;

  for (var i = 0; i < num_tetrah; i++) {
    const tetrah_geometry = new THREE.TetrahedronGeometry(getRandom(2, 7), 0);
    tetrahGroup[i] = new THREE.Mesh(tetrah_geometry, glass_material);
    var x = 0,
      y = 0,
      z = 0;
    while (
      Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2) <=
      Math.pow(vacuum, 2)
    ) {
      x = getRandom(-radius, radius);
      y = getRandom(-radius, radius);
      z = getRandom(-2 * radius, radius);
    }

    tetrahGroup[i].position.set(x, y, z);
    scene.add(tetrahGroup[i]);
  }

  for (var i = 0; i < num_octah; i++) {
    const octah_geometry = new THREE.OctahedronGeometry(getRandom(1, 4), 0);
    octahGroup[i] = new THREE.Mesh(octah_geometry, glass_material);
    var x = 0,
      y = 0,
      z = 0;
    while (
      Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2) <=
      Math.pow(vacuum, 2)
    ) {
      x = getRandom(-radius, radius);
      y = getRandom(-radius, radius);
      z = getRandom(-2 * radius, radius);
    }

    octahGroup[i].position.set(x, y, z);
    scene.add(octahGroup[i]);
  }
}

function glassMaterial() {
  var glassMaterial = new THREE.MeshPhysicalMaterial({
    color: paramsGlassMaterial.color,
    metalness: paramsGlassMaterial.metalness,
    roughness: paramsGlassMaterial.roughness,
    ior: paramsGlassMaterial.ior,
    thickness: paramsGlassMaterial.thickness,
    transmission: paramsGlassMaterial.transmission, // use material.transmission for glass materials
    specularIntensity: paramsGlassMaterial.specularIntensity,
    specularColor: paramsGlassMaterial.specularColor,
    opacity: paramsGlassMaterial.opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
  return glassMaterial;
}

// update small objects in the background
function updateGlassObjectGroup() {
  var low = 6;
  var high = 810;

  var tetrah_scaling = Math.tanh(dataArray[high] * 0.001) * 10 + 1;
  for (var i = 0; i < num_tetrah; i++) {
    tetrahGroup[i].scale.set(tetrah_scaling, tetrah_scaling, tetrah_scaling);
    tetrahGroup[i].material.metalness = Math.tanh(dataArray[high] * 0.01);
    tetrahGroup[i].rotation.y += 0.02 * getRandom(0, 1);
    tetrahGroup[i].rotation.x += 0.02 * getRandom(0, 1);
    tetrahGroup[i].rotation.z += 0.02 * getRandom(0, 1);
  }

  var octah_scaling = Math.tanh(dataArray[low] * 0.001) * 2 + 1;
  for (var i = 0; i < num_octah; i++) {
    octahGroup[i].scale.x = octah_scaling;
    octahGroup[i].scale.y = octah_scaling;
    octahGroup[i].scale.z = octah_scaling;
    octahGroup[i].rotation.y += 0.01 * getRandom(0, 1);
    octahGroup[i].rotation.x += 0.01 * getRandom(0, 1);
    octahGroup[i].rotation.z += 0.01 * getRandom(0, 1);
  }
}

// IMPORTANT! currently only supports model containing exactly one CLOSED mesh
// contains deform init which needs data from fft, so should be called after loadAndAnalyzeAudio()
function importGltfModel(modelPath) {
  const roughnessMipmapper = new RoughnessMipmapper(renderer);
  const loader = new GLTFLoader().setPath(modelPath);
  loader.load("scene.gltf", function (gltf) {
    gltf.scene.traverse(function (child) {
      if (child.isMesh) {
        roughnessMipmapper.generateMipmaps(child.material); // optional
        mesh = child;
      }
    });
    scene.add(gltf.scene);

    roughnessMipmapper.dispose();
  });
}

// IMPORTANT! currently only supports model containing exactly one CLOSED mesh
// contains deform init which needs data from fft, so should be called after loadAndAnalyzeAudio()
function importObjModel(
  modelPath,
  material = new THREE.MeshStandardMaterial({
    color: paramsMeshMaterial.color,
    metalness: paramsMeshMaterial.metalness,
    roughness: paramsMeshMaterial.roughness,
    ior: paramsMeshMaterial.ior,
    transmission: paramsMeshMaterial.transmission, // use material.transmission for glass materials
    specularIntensity: paramsMeshMaterial.specularIntensity,
    specularColor: paramsMeshMaterial.specularColor,
    opacity: paramsMeshMaterial.opacity,
    side: THREE.DoubleSide,
    transparent: true,
  })
) {
  const roughnessMipmapper = new RoughnessMipmapper(renderer);

  const loader = new OBJLoader().setPath(modelPath);
  loader.load("scene.obj", function (obj) {
    obj.traverse(function (child) {
      if (child.isMesh) {
        child.material = material;
        roughnessMipmapper.generateMipmaps(child.material); // optional
        mesh = child;
      }
    });
    mesh.position.set(0, 0, 0);
    scene.add(obj);

    roughnessMipmapper.dispose();
  });
}

function loadAndAnalyzeAudio(song, fftSize = 2048) {
  // load audio
  audio = new Audio();
  audio.src = song;
  audio.load();

  // audio anayliser
  var context = new AudioContext();
  var src = context.createMediaElementSource(audio);
  analyser = context.createAnalyser();
  src.connect(analyser);
  analyser.connect(context.destination);
  analyser.fftSize = fftSize;
  var fftOutputSize = analyser.frequencyBinCount;
  dataArray = new Uint8Array(fftOutputSize);
}

// update everything in a render frame, called in animate()
function updateAll() {
  controls.update();
  stats.update();
  if (mesh) {
    // ensure after mesh has been loaded
    updateMesh();
  }
  updateGlassObjectGroup();
  render();
}

// update the mesh, called in every render frame update loop updateAll()
function updateMesh() {
  analyser.getByteFrequencyData(dataArray);
  const magnitudes = generateFrequencyArray(numDeformLevel);
  meshNormalDeformUpdate(magnitudes);

  scaling_rotation();
}

// control mesh basic scaling and rotation
function scaling_rotation() {
  mesh.rotation.y += 0.01;
  mesh.rotation.x += 0.01;
  mesh.rotation.z += 0.01;

  var low = 6;
  var scalingRate = Math.tanh(dataArray[low] * 0.001) * 4 + 1;
  mesh.scale.set(scalingRate, scalingRate, scalingRate);
}

// numlevel should be greater than or equal to 4.
function generateFrequencyArray(numLevel) {
  console.assert(numLevel >= 4);
  var max = numLevel;
  var interval = Math.floor(max / numLevel);
  var vols = new Object();
  for (var i = 0; i < numLevel; i++)
    vols[i] = Math.tanh(dataArray[i * interval] * 0.001) * 5;

  return vols;
}

// Call either meshVerticalDeformInit() or meshPolarDeformInit(), following paramsMeshMaterial.deformMode
function meshDeformInit(numSegment) {
  if (paramsDeform.deformMode == "slicing") {
    meshVerticalDeformInit(numSegment);
  } else {
    meshPolarDeformInit(numSegment);
  }
}

// Called by meshDeformInit();
// numLevel : number of vertical levels, can be different from direct fft output size, should be small if mesh is small
function meshVerticalDeformInit(numLevel) {
  originalGeometry.computeBoundingBox();
  originalGeometry.computeVertexNormals();
  // originalGeometry.normalizeNormals(); // optional

  const deformLevelHeight =
    (originalGeometry.boundingBox.max.z - originalGeometry.boundingBox.min.z) /
    numLevel;

  const groundZ = originalGeometry.boundingBox.min.z;
  let vertexGroupMap = new Uint8Array(
    originalGeometry.attributes.position.count
  ); // indicates the group that a vertex belongs to
  for (let i = 0; i < originalGeometry.attributes.position.count; ++i) {
    vertexGroupMap[i] = Math.floor(
      (originalGeometry.attributes.position.getZ(i) - groundZ) /
        deformLevelHeight
    );
  }
  originalGeometry.setAttribute("vertexGroupMap", vertexGroupMap);
}

// Called by meshDeformInit();
// numLevel : number of vertical levels, can be different from direct fft output size, should be small if mesh is small
function meshPolarDeformInit(numSegment) {
  originalGeometry.computeBoundingSphere();
  originalGeometry.computeVertexNormals();

  originalGeometry.normalizeNormals(); // optional
  const numSlice = Math.floor(Math.sqrt(numSegment / 2));
  const sliceAngle = Math.PI / numSlice;

  let vertexGroupMap = new Uint8Array(
    originalGeometry.attributes.position.count
  ); // indicates the group that a vertex belongs to
  for (let i = 0; i < originalGeometry.attributes.position.count; ++i) {
    let polarVector = new THREE.Spherical();
    polarVector.setFromCartesianCoords(
      originalGeometry.attributes.position.getX(i) -
        originalGeometry.boundingSphere.center.x,
      originalGeometry.attributes.position.getY(i) -
        originalGeometry.boundingSphere.center.y,
      originalGeometry.attributes.position.getZ(i) -
        originalGeometry.boundingSphere.center.z
    );
    vertexGroupMap[i] =
      Math.floor((polarVector.theta + Math.PI) / sliceAngle) * numSlice +
      Math.floor(polarVector.phi / sliceAngle);
  }

  originalGeometry.setAttribute("vertexGroupMap", vertexGroupMap);
}

function meshMaterialDeformInit(numSegment) {
  if (paramsDeform.deformMode == "slicing") {
    meshMaterialVerticalDeformInit(numSegment);
  } else {
    meshMaterialPolarDeformInit(numSegment);
  }
  displacementMagnitude = new Float32Array(
    mesh.geometry.attributes.position.count
  );
  mesh.geometry.setAttribute(
    "displacementMagnitude",
    new THREE.BufferAttribute(displacementMagnitude, 1)
  );
}

function meshMaterialVerticalDeformInit(numLevel) {
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeVertexNormals();

  const deformLevelHeight =
    (mesh.geometry.boundingBox.max.z - mesh.geometry.boundingBox.min.z) /
    numLevel;

  const groundZ = mesh.geometry.boundingBox.min.z;
  let vertexGroupMap = new Uint8Array(mesh.geometry.attributes.position.count); // indicates the group that a vertex belongs to
  for (let i = 0; i < mesh.geometry.attributes.position.count; ++i) {
    vertexGroupMap[i] = Math.floor(
      (mesh.geometry.attributes.position.getZ(i) - groundZ) / deformLevelHeight
    );
  }
  mesh.geometry.setAttribute(
    "vertexGroupMap",
    new THREE.BufferAttribute(vertexGroupMap, 1)
  );
}

function modifyDeformMaterial() {
  material.onBeforeCompile = function (shader) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      [
        "attribute float displacementMagnitude;",
        "vec3 transformed = vec3(position + normal * vec3(displacementMagnitude));",
      ].join("\n")
    );

    material.userData.shader = shader;
  };
}

function meshNormalDeformUpdate(magnitudes) {
  const vertexGroupMap = originalGeometry.attributes.vertexGroupMap;

  for (let i = 0; i < originalGeometry.attributes.position.count; i++) {
    let vertex = new THREE.Vector3(
      originalGeometry.attributes.position.getX(i),
      originalGeometry.attributes.position.getY(i),
      originalGeometry.attributes.position.getZ(i)
    );

    let normal = new THREE.Vector3(
      originalGeometry.attributes.normal.getX(i),
      originalGeometry.attributes.normal.getY(i),
      originalGeometry.attributes.normal.getZ(i)
    );

    vertex = vertex.add(
      normal.multiplyScalar(
        magnitudes[vertexGroupMap[i]] * paramsDeform.amplitude
      )
    ); // core hack here !

    mesh.geometry.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.material.needsUpdate = true;
}

function meshMaterialNormalDeformUpdate(magnitudes) {
  const vertexGroupMap = mesh.geometry.attributes.vertexGroupMap;

  for (
    let i = 0;
    i < mesh.geometry.attributes.displacementMagnitude.count;
    i++
  ) {
    mesh.geometry.attributes.displacementMagnitude[i] =
      magnitudes[vertexGroupMap[i]] * paramsDeform.amplitude; // core hack here !
  }
  mesh.geometry.attributes.displacementMagnitude.needsUpdate = true;
}

// helper function for texture generating
function generateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 1, 2, 1);

  return canvas;
}

function render() {
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  updateAll();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
