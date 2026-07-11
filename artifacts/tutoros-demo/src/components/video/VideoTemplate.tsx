import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { IntroScene } from './video_scenes/IntroScene';
import { LoginDashboardScene } from './video_scenes/LoginDashboardScene';
import { PrepScene } from './video_scenes/PrepScene';
import { SessionScene } from './video_scenes/SessionScene';
import { VerifyScene } from './video_scenes/VerifyScene';
import { OutroScene } from './video_scenes/OutroScene';

export const SCENE_DURATIONS: Record<string, number> = {
  intro: 4000,
  dashboard: 8000,
  prep: 10000,
  session: 8000,
  verify: 10000,
  outro: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: IntroScene,
  dashboard: LoginDashboardScene,
  prep: PrepScene,
  session: SessionScene,
  verify: VerifyScene,
  outro: OutroScene,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const bgPositions = [
    { x: '-20%', y: '10%' },
    { x: '20%', y: '-10%' },
    { x: '60%', y: '30%' },
    { x: '30%', y: '50%' },
    { x: '-10%', y: '40%' },
    { x: '10%', y: '10%' },
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Persistent background layer */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #1865F2, transparent)' }}
          animate={bgPositions[sceneIndex] ?? bgPositions[0]}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full opacity-5 blur-3xl right-0 bottom-0"
          style={{ background: 'radial-gradient(circle, #10B981, transparent)' }}
          animate={{ opacity: sceneIndex === 5 ? 0 : 0.05 }}
          transition={{ duration: 1 }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
