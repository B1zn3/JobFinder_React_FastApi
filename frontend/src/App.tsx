import { AppRouter } from './app/router'
import { usePresenceSocket } from './shared/hooks/usePresenceSocket'

function App() {
  usePresenceSocket()

  return <AppRouter />
}

export default App