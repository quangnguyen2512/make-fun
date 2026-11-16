import * as THREE from 'three';
import type { EnemyArchetype } from '../game/types';
import { ARENA_RADIUS } from '../game/rules';
import { createArenaTextures, createBrushedMetalRoughness, createContactShadowTexture } from './textures';

export interface WardenRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  shieldDome: THREE.Mesh;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  dorsalRing: THREE.Mesh;
  hullMaterial: THREE.MeshStandardMaterial;
}

export interface EnemyRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  coreMaterial: THREE.MeshStandardMaterial;
  hullMaterial: THREE.MeshStandardMaterial;
  spinner?: THREE.Object3D;
  spinner2?: THREE.Object3D;
  windupRing: THREE.Mesh;
  telegraphBeam?: THREE.Mesh;
}

export interface SanctuaryRig {
  group: THREE.Group;
  obeliskCrystal: THREE.Mesh;
  obeliskRingOuter: THREE.Mesh;
  obeliskRingInner: THREE.Mesh;
  starsMesh: THREE.InstancedMesh;
  dispose: () => void;
}

export class SharedAssetFactory {
  private readonly disposables: Array<{ dispose: () => void }> = [];
  public readonly contactShadowTex: THREE.CanvasTexture;
  public readonly brushedMetalTex: THREE.CanvasTexture;
  public readonly contactShadowMat: THREE.MeshBasicMaterial;
  public readonly contactShadowGeo: THREE.CircleGeometry;

  constructor(private readonly maxAnisotropy: number) {
    this.contactShadowTex = createContactShadowTexture();
    this.brushedMetalTex = createBrushedMetalRoughness(maxAnisotropy);
    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    this.contactShadowGeo = new THREE.CircleGeometry(1, 24);
    this.contactShadowGeo.rotateX(-Math.PI / 2);

    this.disposables.push(
      this.contactShadowTex,
      this.brushedMetalTex,
      this.contactShadowMat,
      this.contactShadowGeo,
    );
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  public makeContactShadow(scale: number): THREE.Mesh {
    const shadow = new THREE.Mesh(this.contactShadowGeo, this.contactShadowMat);
    shadow.scale.set(scale, 1, scale);
    shadow.position.y = 0.015;
    return shadow;
  }

  public buildWarden(): WardenRig {
    const group = new THREE.Group();
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 0.72;
    group.add(bodyGroup);

    // Grounded soft radial shadow
    group.add(this.makeContactShadow(1.35));

    // Materials with >= 0.25 roughness contrast & varied metalness
    const hullMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf4eee1, // Sculpted matte ceramic ivory
        roughness: 0.62,
        metalness: 0.14,
      }),
    );
    const brassMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe5b363, // Celestial brushed brass
        roughness: 0.22,
        roughnessMap: this.brushedMetalTex,
        metalness: 0.88,
      }),
    );
    const slateMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x202b47, // Blued gunmetal nacelles
        roughness: 0.36,
        metalness: 0.72,
      }),
    );
    const canopyMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x38d9a9, // Seafoam armored visor canopy
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        emissive: 0x105545,
        emissiveIntensity: 0.45,
      }),
    );
    const exhaustMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffe4a3,
        emissive: 0x38d9a9,
        emissiveIntensity: 2.2,
        roughness: 0.25,
        metalness: 0.0,
      }),
    );

    // 1. Primary silhouette: Beveled swept delta wing chassis (ExtrudeGeometry)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.18);
    wingShape.lineTo(0.98, -0.45);
    wingShape.lineTo(0.62, -0.82);
    wingShape.lineTo(0.24, -0.58);
    wingShape.lineTo(-0.24, -0.58);
    wingShape.lineTo(-0.62, -0.82);
    wingShape.lineTo(-0.98, -0.45);
    wingShape.closePath();

    const wingGeo = this.track(
      new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      }),
    );
    wingGeo.rotateX(Math.PI / 2);
    const wingMesh = new THREE.Mesh(wingGeo, brassMat);
    wingMesh.position.y = 0.04;
    wingMesh.castShadow = true;
    wingMesh.receiveShadow = true;
    bodyGroup.add(wingMesh);

    // 2. Sculpted central fuselage (LatheGeometry along +Z nose)
    const fusePts = [
      new THREE.Vector2(0.0, -0.78),
      new THREE.Vector2(0.26, -0.68),
      new THREE.Vector2(0.32, -0.15),
      new THREE.Vector2(0.24, 0.55),
      new THREE.Vector2(0.08, 1.15),
      new THREE.Vector2(0.0, 1.32),
    ];
    const fuseGeo = this.track(new THREE.LatheGeometry(fusePts, 20));
    fuseGeo.rotateX(Math.PI / 2);
    const fuseMesh = new THREE.Mesh(fuseGeo, hullMat);
    fuseMesh.position.y = 0.1;
    fuseMesh.castShadow = true;
    bodyGroup.add(fuseMesh);

    // 3. Glossy clearcoat seafoam canopy cockpit
    const canopyGeo = this.track(new THREE.SphereGeometry(0.22, 18, 12));
    canopyGeo.scale(0.82, 0.58, 1.75);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.28, 0.14);
    bodyGroup.add(canopyMesh);

    // 4 & 5. Twin gunmetal engine nacelles
    const nacelleGeo = this.track(new THREE.CylinderGeometry(0.14, 0.18, 0.85, 14));
    nacelleGeo.rotateX(Math.PI / 2);
    const leftNacelle = new THREE.Mesh(nacelleGeo, slateMat);
    leftNacelle.position.set(-0.46, 0.02, -0.45);
    leftNacelle.castShadow = true;
    bodyGroup.add(leftNacelle);

    const rightNacelle = new THREE.Mesh(nacelleGeo, slateMat);
    rightNacelle.position.set(0.46, 0.02, -0.45);
    rightNacelle.castShadow = true;
    bodyGroup.add(rightNacelle);

    // 6 & 7. Twin plasma thruster exhaust cones
    const coneGeo = this.track(new THREE.ConeGeometry(0.13, 0.42, 12));
    coneGeo.rotateX(-Math.PI / 2);
    const thrusterLeft = new THREE.Mesh(coneGeo, exhaustMat);
    thrusterLeft.position.set(-0.46, 0.02, -1.04);
    bodyGroup.add(thrusterLeft);

    const thrusterRight = new THREE.Mesh(coneGeo, exhaustMat);
    thrusterRight.position.set(0.46, 0.02, -1.04);
    bodyGroup.add(thrusterRight);

    // 8. Fore Helios Lance barrel + dorsal astrolabe ring
    const barrelGeo = this.track(new THREE.CylinderGeometry(0.055, 0.08, 0.65, 12));
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, brassMat);
    barrelMesh.position.set(0, 0.08, 1.15);
    bodyGroup.add(barrelMesh);

    const ringGeo = this.track(new THREE.TorusGeometry(0.42, 0.035, 10, 28));
    ringGeo.rotateX(Math.PI / 2);
    const dorsalRing = new THREE.Mesh(ringGeo, brassMat);
    dorsalRing.position.set(0, 0.24, -0.18);
    bodyGroup.add(dorsalRing);

    // 9. Translucent 3D Aegis Parry Sphere Dome (hidden until parry active)
    const domeGeo = this.track(new THREE.SphereGeometry(2.85, 24, 16));
    const domeMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38d9a9,
        transparent: true,
        opacity: 0.26,
        wireframe: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const shieldDome = new THREE.Mesh(domeGeo, domeMat);
    shieldDome.visible = false;
    shieldDome.renderOrder = 3;
    bodyGroup.add(shieldDome);

    return {
      group,
      bodyGroup,
      shieldDome,
      thrusterLeft,
      thrusterRight,
      dorsalRing,
      hullMaterial: hullMat,
    };
  }

  public buildEnemy(type: EnemyArchetype): EnemyRig {
    const group = new THREE.Group();
    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);

    const shadowScale =
      type === 'boss' ? 3.2 : type === 'rammer' ? 1.45 : type === 'weaver' ? 1.3 : 1.05;
    group.add(this.makeContactShadow(shadowScale));

    const windupRingGeo = this.track(new THREE.RingGeometry(0.88, 1.08, 28));
    windupRingGeo.rotateX(-Math.PI / 2);
    const windupRingMat = this.track(
      new THREE.MeshBasicMaterial({
        color: type === 'weaver' ? 0xc388ff : 0xff5a4f,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const windupRing = new THREE.Mesh(windupRingGeo, windupRingMat);
    windupRing.position.y = 0.04;
    windupRing.scale.setScalar(shadowScale);
    windupRing.visible = false;
    group.add(windupRing);

    if (type === 'swarmer') {
      // 4-part agile amber interceptor dart
      bodyGroup.position.y = 0.65;
      const hullMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xf5b041, roughness: 0.32, metalness: 0.65 }),
      );
      const wingMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x2a1d28, roughness: 0.72, metalness: 0.2 }),
      );
      const coreMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xfff0b3,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.8,
          roughness: 0.2,
        }),
      );
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0.75);
      wingShape.lineTo(0.62, -0.35);
      wingShape.lineTo(0, -0.18);
      wingShape.lineTo(-0.62, -0.35);
      wingShape.closePath();
      const wingGeo = this.track(
        new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }),
      );
      wingGeo.rotateX(Math.PI / 2);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.castShadow = true;
      bodyGroup.add(wing);

      const noseGeo = this.track(new THREE.ConeGeometry(0.24, 0.95, 10));
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, hullMat);
      nose.position.set(0, 0.05, 0.15);
      nose.castShadow = true;
      bodyGroup.add(nose);

      const core = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.18, 0)), coreMat);
      core.position.set(0, 0.16, -0.1);
      bodyGroup.add(core);

      const tailFin = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.34, 0.38)), hullMat);
      tailFin.position.set(0, 0.18, -0.35);
      bodyGroup.add(tailFin);

      return { group, bodyGroup, coreMaterial: coreMat, hullMaterial: hullMat, windupRing };
    }

    if (type === 'lancer') {
      // 5-part cobalt sniper frigate with dual rail prongs & telegraph sight beam
      bodyGroup.position.y = 0.72;
      const hullMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x5cb2ff, roughness: 0.28, metalness: 0.78 }),
      );
      const slateMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x16223c, roughness: 0.68, metalness: 0.24 }),
      );
      const coreMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xdbeafe,
          emissive: 0x3b82f6,
          emissiveIntensity: 2.0,
          roughness: 0.2,
        }),
      );

      const hull = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.28, 0.48, 1.3, 6)), slateMat);
      hull.rotation.x = Math.PI / 2;
      hull.castShadow = true;
      bodyGroup.add(hull);

      const railGeo = this.track(new THREE.BoxGeometry(0.12, 0.14, 1.45));
      const leftRail = new THREE.Mesh(railGeo, hullMat);
      leftRail.position.set(-0.36, 0.04, 0.38);
      leftRail.castShadow = true;
      bodyGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, hullMat);
      rightRail.position.set(0.36, 0.04, 0.38);
      rightRail.castShadow = true;
      bodyGroup.add(rightRail);

      const lens = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.22, 1)), coreMat);
      lens.position.set(0, 0.18, 0.45);
      bodyGroup.add(lens);

      const fin = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.15, 0.08, 0.45)), hullMat);
      fin.position.set(0, 0.12, -0.38);
      bodyGroup.add(fin);

      // Telegraph beam extending forward along +Z
      const beamGeo = this.track(new THREE.BoxGeometry(0.1, 0.06, 22));
      beamGeo.translate(0, 0, 11);
      const beamMat = this.track(
        new THREE.MeshBasicMaterial({ color: 0xff5a4f, transparent: true, opacity: 0.6, depthWrite: false }),
      );
      const telegraphBeam = new THREE.Mesh(beamGeo, beamMat);
      telegraphBeam.position.set(0, 0.05, 0.8);
      telegraphBeam.visible = false;
      bodyGroup.add(telegraphBeam);

      return { group, bodyGroup, coreMaterial: coreMat, hullMaterial: hullMat, windupRing, telegraphBeam };
    }

    if (type === 'rammer') {
      // 6-part armored crimson siege prow with dual tusk blades + dash lane telegraph
      bodyGroup.position.y = 0.72;
      const hullMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xd9463e, roughness: 0.35, metalness: 0.72 }),
      );
      const ironMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x261a24, roughness: 0.75, metalness: 0.25 }),
      );
      const coreMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xffb4a2,
          emissive: 0xff453a,
          emissiveIntensity: 2.0,
          roughness: 0.2,
        }),
      );

      const mainBlock = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.05, 0.56, 1.15)), ironMat);
      mainBlock.castShadow = true;
      bodyGroup.add(mainBlock);

      const prowGeo = this.track(new THREE.ConeGeometry(0.62, 0.85, 4));
      prowGeo.rotateY(Math.PI / 4);
      prowGeo.rotateX(Math.PI / 2);
      const prow = new THREE.Mesh(prowGeo, hullMat);
      prow.position.set(0, 0, 0.82);
      prow.castShadow = true;
      bodyGroup.add(prow);

      const tuskGeo = this.track(new THREE.BoxGeometry(0.16, 0.22, 0.78));
      const tuskL = new THREE.Mesh(tuskGeo, hullMat);
      tuskL.position.set(-0.56, -0.02, 0.55);
      bodyGroup.add(tuskL);

      const tuskR = new THREE.Mesh(tuskGeo, hullMat);
      tuskR.position.set(0.56, -0.02, 0.55);
      bodyGroup.add(tuskR);

      const reactor = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 12)), coreMat);
      reactor.position.set(0, 0.34, -0.15);
      bodyGroup.add(reactor);

      const thruster = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.75, 0.26, 0.28)), hullMat);
      thruster.position.set(0, 0.05, -0.68);
      bodyGroup.add(thruster);

      const laneGeo = this.track(new THREE.PlaneGeometry(1.4, 9.5));
      laneGeo.rotateX(-Math.PI / 2);
      laneGeo.translate(0, -0.64, 5.2);
      const laneMat = this.track(
        new THREE.MeshBasicMaterial({ color: 0xff5a4f, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
      );
      const telegraphBeam = new THREE.Mesh(laneGeo, laneMat);
      telegraphBeam.visible = false;
      bodyGroup.add(telegraphBeam);

      return { group, bodyGroup, coreMaterial: coreMat, hullMaterial: hullMat, windupRing, telegraphBeam };
    }

    if (type === 'weaver') {
      // 6-part amethyst astrolabe orbiter with rotating gyro ring & 3 floating emitters
      bodyGroup.position.y = 0.85;
      const hullMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xc388ff, roughness: 0.24, metalness: 0.82 }),
      );
      const darkMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x1e1836, roughness: 0.7, metalness: 0.2 }),
      );
      const coreMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xf3e8ff,
          emissive: 0xa855f7,
          emissiveIntensity: 2.1,
          roughness: 0.15,
        }),
      );

      const core = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.45, 0)), coreMat);
      core.castShadow = true;
      bodyGroup.add(core);

      const spinner = new THREE.Group();
      bodyGroup.add(spinner);

      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.78, 0.075, 10, 24)), hullMat);
      ring.rotation.x = Math.PI / 2;
      spinner.add(ring);

      const podGeo = this.track(new THREE.BoxGeometry(0.24, 0.28, 0.24));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const pod = new THREE.Mesh(podGeo, darkMat);
        pod.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
        spinner.add(pod);
      }

      const crown = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.46, 0.05, 8, 18)), hullMat);
      crown.rotation.y = Math.PI / 3;
      bodyGroup.add(crown);

      return { group, bodyGroup, coreMaterial: coreMat, hullMaterial: hullMat, spinner, windupRing };
    }

    // 'boss': 10-part Eclipse Leviathan Dreadnought
    bodyGroup.position.y = 1.65;
    const hullMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x2b1b2e, roughness: 0.65, metalness: 0.25 }),
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe5b363,
        roughness: 0.22,
        roughnessMap: this.brushedMetalTex,
        metalness: 0.9,
      }),
    );
    const coreMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd1c7,
        emissive: 0xff453a,
        emissiveIntensity: 2.6,
        roughness: 0.15,
      }),
    );

    const chassis = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(1.55, 1)), hullMat);
    chassis.scale.set(1.25, 0.72, 1.35);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const core = new THREE.Mesh(this.track(new THREE.IcosahedronGeometry(0.75, 1)), coreMat);
    core.position.y = 0.25;
    bodyGroup.add(core);

    const spinner = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.15, 0.12, 12, 36)), goldMat);
    spinner.rotation.x = Math.PI / 2;
    bodyGroup.add(spinner);

    const spinner2 = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.65, 0.09, 10, 32)), goldMat);
    spinner2.rotation.x = Math.PI / 3;
    bodyGroup.add(spinner2);

    const bladeGeo = this.track(new THREE.BoxGeometry(0.42, 0.32, 1.6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const wing = new THREE.Mesh(bladeGeo, i % 2 === 0 ? goldMat : hullMat);
      wing.position.set(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
      wing.rotation.y = -a + Math.PI / 2;
      wing.castShadow = true;
      bodyGroup.add(wing);
    }

    return {
      group,
      bodyGroup,
      coreMaterial: coreMat,
      hullMaterial: hullMat,
      spinner,
      spinner2,
      windupRing,
    };
  }

  public buildSanctuaryArena(scene: THREE.Scene): SanctuaryRig {
    const group = new THREE.Group();
    const tex = createArenaTextures(this.maxAnisotropy);
    this.disposables.push(tex);

    // 1. Primary stepped circular sanctuary arena deck (y = 0)
    const floorGeo = this.track(new THREE.CylinderGeometry(ARENA_RADIUS + 0.8, ARENA_RADIUS + 1.5, 0.6, 64));
    floorGeo.translate(0, -0.3, 0);
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.albedo,
        roughnessMap: tex.roughness,
        bumpMap: tex.bump,
        bumpScale: 0.03,
        roughness: 0.85,
        metalness: 0.18,
      }),
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // 2. Outer beveled brass rim (y = 0.03 to avoid coplanar Z-fighting)
    const rimGeo = this.track(new THREE.TorusGeometry(ARENA_RADIUS + 0.45, 0.36, 12, 72));
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe5b363,
        roughness: 0.25,
        roughnessMap: this.brushedMetalTex,
        metalness: 0.88,
      }),
    );
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.03;
    rimMesh.receiveShadow = true;
    group.add(rimMesh);

    // 3. Extended horizon void sea plane below arena (blends seamlessly into FogExp2)
    const seaGeo = this.track(new THREE.CircleGeometry(150, 48));
    seaGeo.rotateX(-Math.PI / 2);
    const seaMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x070b18,
        roughness: 0.9,
        metalness: 0.1,
      }),
    );
    const seaMesh = new THREE.Mesh(seaGeo, seaMat);
    seaMesh.position.y = -0.75;
    group.add(seaMesh);

    // 4. Central 6-part Sun-Core Obelisk Monument (grounded pivot at y = 0)
    const obeliskGroup = new THREE.Group();
    const plinthMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x161f3b, roughness: 0.72, metalness: 0.25 }),
    );
    const crystalMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfde3a7,
        emissive: 0xe5b363,
        emissiveIntensity: 1.5,
        roughness: 0.15,
        metalness: 0.2,
      }),
    );

    const baseStep1 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.15, 2.35, 0.35, 8)), plinthMat);
    baseStep1.position.y = 0.175;
    baseStep1.receiveShadow = true;
    baseStep1.castShadow = true;
    obeliskGroup.add(baseStep1);

    const baseStep2 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.5, 1.8, 0.45, 8)), rimMat);
    baseStep2.position.y = 0.55;
    baseStep2.castShadow = true;
    obeliskGroup.add(baseStep2);

    const spireGeo = this.track(new THREE.ConeGeometry(0.92, 4.4, 6));
    const obeliskCrystal = new THREE.Mesh(spireGeo, crystalMat);
    obeliskCrystal.position.y = 3.1;
    obeliskCrystal.castShadow = true;
    obeliskGroup.add(obeliskCrystal);

    const obeliskRingOuter = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.72, 0.08, 10, 32)), rimMat);
    obeliskRingOuter.position.y = 2.65;
    obeliskGroup.add(obeliskRingOuter);

    const obeliskRingInner = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.22, 0.06, 10, 28)), rimMat);
    obeliskRingInner.position.y = 2.65;
    obeliskRingInner.rotation.y = Math.PI / 2;
    obeliskGroup.add(obeliskRingInner);

    // 4 grounded beacon pylons around the plinth
    const pylonGeo = this.track(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6));
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(pylonGeo, plinthMat);
      pylon.position.set(Math.cos(a) * 1.85, 0.7, Math.sin(a) * 1.85);
      pylon.castShadow = true;
      obeliskGroup.add(pylon);
    }
    group.add(obeliskGroup);

    // 5. InstancedMesh of 18 perimeter basalt monolith spires beyond the arena ring
    const spireCount = 18;
    const monolithGeo = this.track(new THREE.CylinderGeometry(0.7, 1.8, 9.5, 6));
    monolithGeo.translate(0, 4.75, 0);
    const monolithMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.16 }),
    );
    const monoliths = new THREE.InstancedMesh(monolithGeo, monolithMat, spireCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < spireCount; i++) {
      const ang = (i / spireCount) * Math.PI * 2 + (i % 2 === 0 ? 0.06 : -0.04);
      const dist = ARENA_RADIUS + 4.8 + (i % 3) * 2.1;
      const scaleH = 0.85 + ((i * 7) % 10) * 0.04;
      const scaleW = 0.88 + ((i * 5) % 7) * 0.04;
      dummy.position.set(Math.cos(ang) * dist, -0.75, Math.sin(ang) * dist);
      dummy.rotation.set(0, ang, (i % 2 === 0 ? 1 : -1) * 0.05);
      dummy.scale.set(scaleW, scaleH, scaleW);
      dummy.updateMatrix();
      monoliths.setMatrixAt(i, dummy.matrix);

      tint.setHSL(0.62 + (i % 3) * 0.02, 0.32, 0.12 + (i % 4) * 0.025);
      monoliths.setColorAt(i, tint);
    }
    monoliths.instanceMatrix.needsUpdate = true;
    if (monoliths.instanceColor) monoliths.instanceColor.needsUpdate = true;
    monoliths.computeBoundingSphere();
    group.add(monoliths);

    // 6. InstancedMesh of 240 celestial starfield motes
    const starCount = 240;
    const starGeo = this.track(new THREE.OctahedronGeometry(0.16, 0));
    const starMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xffe8ba }),
    );
    const starsMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
    for (let i = 0; i < starCount; i++) {
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = 28 + ((i * 19.7) % 62);
      const y = -3 + ((i * 7.3) % 26);
      const s = 0.5 + ((i * 3) % 5) * 0.28;
      dummy.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      dummy.rotation.set(i * 0.5, i * 0.3, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      starsMesh.setMatrixAt(i, dummy.matrix);
      tint.setHex(i % 5 === 0 ? 0x38d9a9 : i % 3 === 0 ? 0x9ec5ff : 0xfde3a7);
      starsMesh.setColorAt(i, tint);
    }
    starsMesh.instanceMatrix.needsUpdate = true;
    if (starsMesh.instanceColor) starsMesh.instanceColor.needsUpdate = true;
    starsMesh.computeBoundingSphere();
    group.add(starsMesh);

    scene.add(group);

    return {
      group,
      obeliskCrystal,
      obeliskRingOuter,
      obeliskRingInner,
      starsMesh,
      dispose: () => {
        scene.remove(group);
      },
    };
  }

  public disposeAll() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
