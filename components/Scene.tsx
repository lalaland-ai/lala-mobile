import { Canvas } from "@react-three/fiber/native";
import VrmAvatar from "./VrmAvatar";
import { Matrix4, Vector3, Quaternion, Euler, MathUtils } from "three";
import { defaultAnimations } from "../constants/animations";

export default function App() {
  return (
    <>
      <Canvas>
        <ambientLight intensity={0.5} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={1}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={1} />

        <VrmAvatar
          matrix={new Matrix4().compose(
            new Vector3(0, -0.8, 3.8),
            new Quaternion().setFromEuler(
              new Euler(MathUtils.degToRad(5), MathUtils.degToRad(180), 0)
            ),
            new Vector3(1, 1, 1)
          )}
          vrmUrl="https://lalaland.chat/vrms/purple-girl.vrm"
          animations={defaultAnimations}
          audioRef={undefined}
          scale={[1, 1, 1]}
        />
      </Canvas>
    </>
  );
}
