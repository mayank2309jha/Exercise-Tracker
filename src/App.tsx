import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data/store';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { LogWorkout } from './pages/LogWorkout';
import { ExerciseLibrary } from './pages/ExerciseLibrary';
import { WorkoutHistory } from './pages/WorkoutHistory';
import { StrengthProgress } from './pages/StrengthProgress';
import { CardioAnalytics } from './pages/CardioAnalytics';
import { BodyMeasurements } from './pages/BodyMeasurements';
import { Goals } from './pages/Goals';
import { Settings } from './pages/Settings';
import type { AppState } from './domain/types';

export function AppRoutes() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<LogWorkout />} />
          <Route path="/log/:sessionId" element={<LogWorkout />} />
          <Route path="/library" element={<ExerciseLibrary />} />
          <Route path="/history" element={<WorkoutHistory />} />
          <Route path="/strength" element={<StrengthProgress />} />
          <Route path="/cardio" element={<CardioAnalytics />} />
          <Route path="/body" element={<BodyMeasurements />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export function App({ initialState }: { initialState?: AppState }) {
  return (
    <StoreProvider initial={initialState}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </StoreProvider>
  );
}
