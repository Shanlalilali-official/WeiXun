import type { ProjectOnePublicBrief } from '@/lib/contracts/project-one-onboarding';

interface ProjectOneOnboarding {
  open(options: {
    onStart: (brief: ProjectOnePublicBrief) => void | Promise<void>;
    onClose?: () => void;
  }): void;
}

declare global {
  interface Window {
    ProjectOneOnboarding?: ProjectOneOnboarding;
  }
}

let pending: Promise<ProjectOneOnboarding> | undefined;

export function loadProjectOneOnboarding(): Promise<ProjectOneOnboarding> {
  if (window.ProjectOneOnboarding) return Promise.resolve(window.ProjectOneOnboarding);
  if (pending) return pending;
  pending = new Promise<ProjectOneOnboarding>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/project-one-onboarding.js';
    const fail = () => {
      script.remove();
      reject(new Error('开场界面暂时无法打开，请重试。'));
    };
    script.onload = () => {
      if (window.ProjectOneOnboarding) resolve(window.ProjectOneOnboarding);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
