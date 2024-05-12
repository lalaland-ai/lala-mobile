import React, {
  MutableRefObject,
  RefObject,
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {
  VRM,
  VRMUtils,
  VRMLoaderPlugin,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
  VRMExpressionPresetName,
} from "@pixiv/three-vrm";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Matrix4,
  Mesh,
  NumberKeyframeTrack,
  Vector3,
} from "three";
import { loadMixamoAnimation } from "../helpers/loadMixamoAnimation";

export const emotions = {
  happy: VRMExpressionPresetName.Happy,
  sad: VRMExpressionPresetName.Sad,
  angry: VRMExpressionPresetName.Angry,
  relaxed: VRMExpressionPresetName.Relaxed,
  surprised: VRMExpressionPresetName.Surprised,
  neutral: VRMExpressionPresetName.Neutral,
};

interface VrmAvatarProps {
  matrix: Matrix4;
  meshRef?: MutableRefObject<any>;
  vrmUrl: string;
  animations: Record<"greet" | "idle" | "talk" | "bored" | "walk", string[]>;
  scale: number[];
  audioRef?: RefObject<HTMLAudioElement>;
  lookAt?: Vector3;
  gltfLoaded?: (gltf: GLTF) => void;
}

const VrmAvatar = forwardRef(
  (
    {
      matrix,
      meshRef,
      vrmUrl,
      animations,
      scale,
      audioRef,
      lookAt,
      gltfLoaded,
    }: VrmAvatarProps,
    ref
  ) => {
    const [gltf, setGltf] = useState<GLTF | null>(null);
    const [animationMixer, setAnimationMixer] = useState<AnimationMixer | null>(
      null
    );
    const [prevVrmUrl, setPrevVrmUrl] = useState<string | null>(null);

    const [animationCache, setAnimationCache] = useState<
      Record<string, AnimationAction[]>
    >({});
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    const loader = useMemo(() => {
      return new GLTFLoader().register(
        (parser) =>
          new VRMLoaderPlugin(parser, {
            autoUpdateHumanBones: true,
          })
      );
    }, []);

    const gltfRef = useRef<Mesh>();
    const vrmRef = useRef<VRM>();

    useFrame(({}, delta) => {
      if (animationMixer?.update) {
        animationMixer.update(delta);
      }
      if (vrmRef?.current?.update) {
        vrmRef.current.update(delta);
      }
      if (meshRef && !meshRef.current) {
        meshRef.current = gltfRef.current;
      }

      if (gltfRef?.current?.matrix && matrix) {
        gltfRef.current.matrix.copy(matrix);
        gltfRef.current.matrix.decompose(
          gltfRef.current.position,
          gltfRef.current.quaternion,
          gltfRef.current.scale
        );
      }

      if (gltfRef?.current?.lookAt && lookAt) {
        gltfRef.current.lookAt(lookAt);
        gltfRef.current.rotateY(Math.PI);
      }
    });

    const getRandomAnimation = useCallback(
      (type: string) => {
        const randomAnim = (animations as any)?.[type]?.[
          Math.floor(Math.random() * (animations as any)?.[type]?.length)
        ];

        return randomAnim;
      },
      [animations]
    );

    const playAnimation = useCallback(
      async (type: string) => {
        animationCache[type][0].reset().setLoop(LoopOnce, 1).play();
      },
      [animationCache]
    );

    const moveMouth = useCallback(
      async (audioUrl: string) => {
        try {
          const audioResp = await fetch(audioUrl);
          const audioBuffer = await audioResp.arrayBuffer();
          const source = audioContext?.createBufferSource();
          const audio = await audioContext?.decodeAudioData(audioBuffer);

          if (!source || !audio || !analyser) {
            return;
          }

          source.buffer = audio;
          source?.connect(analyser);
          source.start(0);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateMouth = () => {
            requestAnimationFrame(updateMouth);

            analyser?.getByteFrequencyData(dataArray);

            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const normalizationFactor = 50;
            const normalizedVolume = Math.min(1, volume / normalizationFactor);

            // Set the weight of the 'Aa' blend shape based on the volume
            vrmRef?.current?.expressionManager?.setValue(
              "aa",
              normalizedVolume
            );
            vrmRef?.current?.expressionManager?.update();
          };

          updateMouth();
        } catch (error) {
          console.error(error);
        }
      },
      [audioContext, analyser]
    );

    const setupAudioAnalyser = useCallback(async () => {
      const audioContext = new window.AudioContext();
      setAudioContext(audioContext);

      const analyser = audioContext?.createAnalyser();
      setAnalyser(analyser);
    }, []);

    const setupAnimations = useCallback(async () => {
      return new Promise(async (resolve) => {
        if (!vrmRef?.current?.expressionManager) {
          return;
        }
        const mixer = new AnimationMixer(vrmRef.current.scene);
        mixer.timeScale = 1.0;
        setAnimationMixer(mixer);

        // load walk animation
        const randomWalk = getRandomAnimation("walk");
        const walkClip = await loadMixamoAnimation(randomWalk, vrmRef.current);
        const walkAction = mixer.clipAction(walkClip);

        // // load idle animation
        const randomIdle = getRandomAnimation("idle");
        const idleClip = await loadMixamoAnimation(randomIdle, vrmRef.current);
        const idleAction = mixer.clipAction(idleClip);

        setAnimationCache((prev) => ({
          ...prev,
          walk: [...(prev?.walk || []), walkAction],
          idle: [...(prev?.idle || []), idleAction],
        }));

        idleAction.play();

        // blink loop
        const blinkTrack =
          vrmRef.current.expressionManager.getExpressionTrackName("blink");
        const blinkKeys = new NumberKeyframeTrack(
          blinkTrack as string,
          [0.0, 0.2, 0.4, 6.0], // times
          [0.0, 1.0, 0.0, 0.0] // values
        );
        const blinkClip = new AnimationClip(
          blinkTrack as string,
          6.8, // duration
          [blinkKeys]
        );
        const action = mixer.clipAction(blinkClip);
        action.play();
        resolve(mixer);
      });
    }, [getRandomAnimation]);

    // load vrm and play greet animation
    useEffect(() => {
      if ((!gltf && vrmUrl) || prevVrmUrl !== vrmUrl) {
        loader.loadAsync(vrmUrl).then(async (gltf) => {
          setPrevVrmUrl(vrmUrl);
          const vrm = gltf.userData.vrm as VRM;
          VRMUtils.removeUnnecessaryJoints(vrm.scene);
          VRMUtils.removeUnnecessaryVertices(vrm.scene);

          vrm.scene.traverse((obj) => {
            obj.frustumCulled = false;
          });

          const vrmScale = scale[0];

          if (scale[0] && vrm.springBoneManager) {
            vrm.scene.scale.setScalar(scale[0]);

            // scale joints
            for (const joint of vrm.springBoneManager.joints) {
              joint.settings.stiffness *= vrmScale;
              joint.settings.hitRadius *= vrmScale;
            }

            // scale colliders
            for (const collider of vrm.springBoneManager.colliders) {
              const shape = collider.shape;
              if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
                shape.radius *= vrmScale;
                shape.tail.multiplyScalar(vrmScale);
              } else if (shape instanceof VRMSpringBoneColliderShapeSphere) {
                shape.radius *= vrmScale;
              }
            }
          }

          setGltf(gltf);

          vrmRef.current = vrm;

          gltfLoaded?.(gltf);

          await setupAnimations();
          await setupAudioAnalyser();
        });
      }
    }, [
      vrmUrl,
      scale,
      gltf,
      loader,
      prevVrmUrl,
      getRandomAnimation,
      gltfLoaded,
      playAnimation,
      setupAnimations,
      setupAudioAnalyser,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        getPosition: () => {
          const position = gltfRef?.current?.matrixWorld
            ? new Vector3().setFromMatrixPosition?.(gltfRef.current.matrixWorld)
            : new Vector3(0, 0, 0);
          return position;
        },
        getRotation: () => {
          return gltfRef?.current?.rotation.toArray() || [0, 0, 0];
        },
        talk: async (audioUrl: string, targetLookAt?: number[]) =>
          new Promise(async (resolve) => {
            if (!vrmRef.current || !animationMixer || !audioRef?.current) {
              return;
            }
            const randomTalk = getRandomAnimation("talk");
            const talkClip = await loadMixamoAnimation(
              randomTalk,
              vrmRef.current
            );
            const talkAction = animationMixer?.clipAction(talkClip);
            talkAction?.reset().setLoop(LoopOnce, 1).fadeIn(1).play();

            // Calculate the duration of the action
            const actionDuration = talkClip.duration;

            // Set a timeout to start fading out the action a little before it ends
            setTimeout(() => {
              talkAction?.fadeOut(1);
            }, (actionDuration - 1) * 1000); // Subtract the fade out duration from the action duration

            await moveMouth(audioUrl);

            audioRef.current.src = audioUrl;

            // if audio fails on IOS, skip and keep going
            try {
              await audioRef.current.play();

              audioRef.current.addEventListener("ended", () => {
                if (talkAction.isRunning()) {
                  talkAction.fadeOut(1);
                }
                resolve("ended");
              });
            } catch (e) {
              console.error(e);
              setTimeout(() => {
                if (talkAction.isRunning()) {
                  talkAction.fadeOut(1);
                }
                resolve("ended");
              }, 5000);
            }
          }),
        playEmotion: async (emotion: string) => {
          const expressionManager = vrmRef.current?.expressionManager;

          if (expressionManager) {
            const transitionSpeed = 0.1; // Adjust this value to change the speed of the transition
            const updateFrequency = 75; // Adjust this value to change the frequency of the updates

            // Transition into the emotion
            const transitionInInterval = setInterval(() => {
              const currentValue = expressionManager.getValue(emotion) || 0;
              if (currentValue >= 1) {
                clearInterval(transitionInInterval);
              } else {
                expressionManager.setValue(
                  emotion,
                  currentValue + transitionSpeed
                );
                expressionManager.update();
              }
            }, updateFrequency);

            // Wait for 2-3 seconds, then transition out of the emotion
            setTimeout(() => {
              const transitionOutInterval = setInterval(() => {
                const currentValue = expressionManager.getValue(emotion) || 0;
                if (currentValue <= 0) {
                  clearInterval(transitionOutInterval);
                } else {
                  expressionManager.setValue(
                    emotion,
                    currentValue - transitionSpeed
                  );
                  expressionManager.update();
                }
              }, updateFrequency);
            }, 2000 + Math.random() * 1000); // Wait for a random time between 2 and 3 seconds
          }
        },
        getGltfRef: () => gltfRef.current,
      }),
      [
        playAnimation,
        getRandomAnimation,
        animationMixer,
        moveMouth,
        gltfRef,
        vrmRef,
        audioRef,
      ]
    );

    return (
      <>
        {gltf?.scene && (
          <Suspense fallback={null}>
            <primitive
              matrix={matrix}
              object={gltf.scene}
              ref={gltfRef}
              scale={scale || [1, 1, 1]}
            />
          </Suspense>
        )}
      </>
    );
  }
);

export default VrmAvatar;
