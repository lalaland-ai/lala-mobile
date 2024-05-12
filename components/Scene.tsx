import { Canvas } from "@react-three/fiber/native";
import { Box } from "@react-three/drei/native";

export default function App() {
  return (
    <Canvas>
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      <Box position={[-1, 0, 0]}>
        <meshStandardMaterial color="hotpink" />
      </Box>
      <Box position={[1, 0, 0]}>
        <meshStandardMaterial color="lightblue" />
      </Box>
    </Canvas>
  );
}
