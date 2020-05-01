// @ts-ignore
import tilesPng from '../img/tiles.auto.png';
// @ts-ignore
import tableJpg from '../img/table.jpg';

import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { World } from './world';
import { Object3D, Scene, Camera, WebGLRenderer, Texture, Vector2, Raycaster, Mesh, MeshLambertMaterial } from 'three';

export class View {
  world: World;

  main: Element;
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  raycaster: Raycaster;

  objects: Array<Mesh>;
  ghostObjects: Array<Mesh>;
  shadows: Array<Mesh>;
  raycastObjects: Array<Object3D>;
  raycastTable: Object3D;
  tileTexture: Texture;

  width: number;
  height: number;
  static RATIO = 1.5;
  mouse: Vector2;

  constructor(main: Element, world: World) {
    this.main = main;
    this.world = world;
    this.objects = [];

    this.scene = new THREE.Scene();
    this.camera = this.makeCamera(false);

    this.raycaster = new THREE.Raycaster();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    main.appendChild(this.renderer.domElement);

    const tableTexture = new THREE.TextureLoader().load(tableJpg);
    tableTexture.wrapS = THREE.RepeatWrapping;
    tableTexture.wrapT = THREE.RepeatWrapping;
    tableTexture.repeat.set(3, 3);
    const tableGeometry = new THREE.PlaneGeometry(
      World.WIDTH + World.TILE_DEPTH, World.HEIGHT + World.TILE_DEPTH);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, map: tableTexture });
    const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    tableMesh.position.set(World.WIDTH / 2, World.HEIGHT / 2, 0);
    this.scene.add(tableMesh);

    this.tileTexture = new THREE.TextureLoader().load(tilesPng);
    // this.tileTexture.minFilter = THREE.LinearMipmapNearestFilter;
    // this.tileTexture.minFilter = THREE.LinearFilter;
    // this.tileTexture.generateMipmaps = false;
    this.tileTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.objects = [];
    this.ghostObjects = [];
    this.shadows = [];
    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeTileObject(this.world.things[i].index);
      this.objects.push(obj);
      this.scene.add(obj);

      const gobj = this.makeGhostObject(this.world.things[i].index);
      this.ghostObjects.push(gobj);
      this.scene.add(gobj);

      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.2,
        color: 0,
      });
      const shadow = new Mesh(geometry, material);
      shadow.visible = false;
      this.shadows.push(shadow);
      this.scene.add(shadow);
    }

    for (const shadow of this.world.toRenderPlaces()) {
      const w = Math.max(shadow.width, World.TILE_WIDTH);
      const h = Math.max(shadow.height, World.TILE_WIDTH);

      const geometry = new THREE.PlaneGeometry(w, h);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.1,
        color: 0,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(shadow.position.x, shadow.position.y, 0.1);
      this.scene.add(mesh);
    }

    this.raycastObjects = [];
    for (let i = 0; i < Object.keys(this.world.slots).length; i++) {
      const robj = new THREE.Mesh(new THREE.BoxGeometry(
        World.TILE_WIDTH,
        World.TILE_HEIGHT,
        World.TILE_DEPTH)
      );
      robj.visible = false;
      this.raycastObjects.push(robj);
      this.scene.add(robj);
    }

    this.raycastTable = new THREE.Mesh(new THREE.PlaneGeometry(
      World.WIDTH * 3,
      World.HEIGHT * 3,
    ));
    this.raycastTable.visible = false;
    this.raycastTable.position.set(World.WIDTH / 2, World.HEIGHT / 2, 0);
    this.scene.add(this.raycastTable);

    this.scene.add(new THREE.AmbientLight(0xcccccc));
    const dirLight = new THREE.DirectionalLight(0x3333333);
    this.scene.add(dirLight);
    dirLight.position.set(0, 0, 999);

    this.mouse = new Vector2();
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  makeCamera(perspective: boolean): THREE.Camera {
    if (perspective) {
      const camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      camera.rotateX(Math.PI * 0.3);
      return camera;
    }

    const camera = new THREE.OrthographicCamera(
      -4, World.WIDTH + 4,
      (World.WIDTH + 8) / View.RATIO, 0,
      0.1, 1000);
    camera.position.set(0, -18, 2);
    camera.rotateX(Math.PI * 0.3);
    return camera;
  }

  setPerspective(perspective: boolean): void {
    this.camera = this.makeCamera(perspective);
  }

  makeTileObject(index: number): Mesh {
    const geometry = new THREE.BoxGeometry(
      World.TILE_WIDTH,
      World.TILE_HEIGHT,
      World.TILE_DEPTH
    );

    function setFace(ia: number, ib: number,
      u0: number, v0: number, w: number, h: number): void {

      u0 /= 256;
      v0 /= 256;
      const u1 = u0 + w/256;
      const v1 = v0 + h/256;

      geometry.faceVertexUvs[0][ia][0].set(u0, v0);
      geometry.faceVertexUvs[0][ia][1].set(u0, v1);
      geometry.faceVertexUvs[0][ia][2].set(u1, v0);

      geometry.faceVertexUvs[0][ib][0].set(u0, v1);
      geometry.faceVertexUvs[0][ib][1].set(u1, v1);
      geometry.faceVertexUvs[0][ib][2].set(u1, v0);
    }

    // const u0 = 224 / 256;
    // const v0 = 188 / 256;
    // const u1 = 256 / 256;
    // const v1 = 235 / 256;

    const i = index % 8;
    const j = Math.floor(index / 8);

    // long side
    setFace(0, 1, 216, 21, -24, 47);
    setFace(2, 3, 192, 21, 24, 47);

    // short side
    setFace(4, 5, 160, 68, 32, -24);
    setFace(6, 7, 160, 44, 32, 24);

    // back
    setFace(10, 11, 224, 21, 32, 47);

    // front
    setFace(8, 9, i * 32, 256 - j * 47, 32, -47);

    const bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry);

    const frontMaterial = new THREE.MeshLambertMaterial({color: 0xeeeeee, map: this.tileTexture });

    const mesh = new THREE.Mesh(bufferGeometry, frontMaterial);

    return mesh;
  }

  makeGhostObject(index: number): Mesh {
    const obj = this.makeTileObject(index);
    const material = obj.material as MeshLambertMaterial;
    material.transparent = true;
    material.opacity = 0.5;
    return obj;
  }

  draw(): void {
    requestAnimationFrame(this.draw.bind(this));

    this.updateRender();
    this.updateRenderGhosts();
    this.updateRenderShadows();

    this.renderer.render(this.scene, this.camera);
    this.updateViewport();
  }

  updateSelect(): void {
    const toSelect = this.world.toSelect();
    if (toSelect.length === 0) {
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const robjs = [];
    for (let i = 0; i < toSelect.length; i++) {
      const select = toSelect[i];
      const robj = this.raycastObjects[i];
      robj.position.copy(select.position);
      robj.rotation.copy(select.rotation);
      robj.updateMatrixWorld();
      robj.userData.id = select.id;
      robjs.push(robj);
    }

    const intersects = this.raycaster.intersectObjects(robjs);
    let id = null;
    if (intersects.length > 0) {
      id = intersects[0].object.userData.id;
    }

    const intersectsTable = this.raycaster.intersectObject(this.raycastTable);
    let tablePos = null;
    if (intersectsTable.length > 0) {
      const point = intersectsTable[0].point;
      tablePos = new Vector2(point.x, point.y);
    }

    this.world.onSelect(id, tablePos);
  }

  updateRender(): void {
    for (const obj of this.objects) {
      obj.visible = false;
    }

    for (const render of this.world.toRender()) {
      const obj = this.objects[render.thingIndex];
      obj.visible = true;
      obj.position.copy(render.position);
      obj.rotation.copy(render.rotation);

      const material = obj.material as MeshLambertMaterial;
      if (render.selected) {
        material.emissive.setHex(0x222222);
      } else {
        material.emissive.setHex(0);
      }
      if (render.held) {
        material.transparent = true;
        material.opacity = render.temporary ? 0.7 : 1;
        obj.position.z += 2;
        obj.renderOrder = 1;
        material.depthTest = false;
      } else {
        material.transparent = false;
        obj.renderOrder = 0;
        material.depthTest = true;
      }
    }
  }

  updateRenderGhosts(): void {
    for (const obj of this.ghostObjects) {
      obj.visible = false;
    }

    for (const render of this.world.toRenderGhosts()) {
      const obj = this.ghostObjects[render.thingIndex];
      obj.visible = true;
      obj.position.copy(render.position);
      obj.rotation.copy(render.rotation);
    }
  }

  updateRenderShadows(): void {
    for (const obj of this.shadows) {
      obj.visible = false;
    }

    let i = 0;
    for (const shadow of this.world.toRenderShadows()) {
      const obj = this.shadows[i++];
      obj.visible = true;
      obj.position.set(shadow.position.x, shadow.position.y, 0.2);
      obj.scale.set(shadow.width, shadow.height, 1);
    }
  }

  onMouseMove(event: MouseEvent): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    this.mouse.x = event.offsetX / w * 2 - 1;
    this.mouse.y = -event.offsetY / h * 2 + 1;

    this.updateSelect();
  }

  onMouseLeave(event: MouseEvent): void {
    this.world.onSelect(null, null);
  }

  onMouseDown(event: MouseEvent): void {
    this.world.onMouseDown();
    this.updateSelect();
  }

  onMouseUp(event: MouseEvent): void {
    this.world.onMouseUp();
    this.updateSelect();
  }

  updateViewport(): void {
    if (this.main.clientWidth !== this.width ||
      this.main.clientHeight !== this.height) {

      this.width = this.main.clientWidth;
      this.height = this.main.clientHeight;

      let renderWidth: number, renderHeight: number;

      if (this.width / this.height > View.RATIO) {
        renderWidth = Math.floor(this.height * View.RATIO);
        renderHeight = Math.floor(this.height);
      } else {
        renderWidth = Math.floor(this.width);
        renderHeight = Math.floor(this.width / View.RATIO);
      }
      this.renderer.setSize(renderWidth, renderHeight);
    }
  }
}