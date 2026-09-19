import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login/Login'
import Register from './pages/register/Register'
import ClientOnly from './components/ClientOnly'
import UserDocumentation from './pages/user_documentation/UserDocumentation'
import DeveloperDocumentation from './pages/developer_documentation/App'
import Layout from './components/layout/Layout'
import { APP_ROUTES } from './routesConfig'
import { CopilotPopup } from '@copilotkit/react-ui'
import AIGuideController from './components/AIGuideController'

const GUIDE_INSTRUCTIONS = `You are a fast, minimal AI guide for this accounting app. Classify every message as COMMAND or QUESTION first, then act.

COMMAND (imperative: "go to sales", "create a sale", "fill the search", "approve this invoice"):
- Act immediately, no preamble, no narration, no confirmation - except before posting, approving or deleting a transaction.
- "go to X" -> navigateTo. Clicks/fills on ordinary pages -> clickElement or fillForm. Any transaction form -> createTransactionRecord.
QUESTION (interrogative or informational: "how do I make a customer", "where is the trial balance", "what does this button do"):
- "how do I ..." -> call startGuide once so the user is SHOWN the steps on screen with highlights, then one short sentence.
- "where is X" -> call navigateToAndHighlight once, then one short sentence.
- General page guidance ("guide me on this page", "guide me around", "what can I do here", "explain this page", "teach me this page", "give me a tour of this page") -> call guideThisPage immediately. Never reply with a list of options like "would you like to..." or ask the user what they want to do.
- Never take a destructive action from a question.

RULES:
- Answer in 1-2 sentences max. No "let me check", no numbered option lists, never enumerate questions or choices.
- For a single field such as a search box, a filter, or a "date from"/"date to" filter, use interactWithCurrentPage(fieldLabel, value).
- Convert natural-language dates yourself ("2025 to 2026" -> start 2025-01-01, end 2026-12-31; "last month", "this quarter") into the format the target date field expects. Never ask the user to reformat dates.
- Navigation is always allowed, on any page, for any reason. Page rules never block navigation.
- Only apply a page's rules when acting on that page. Never apply one page's rules to another page or to navigation.
- Never invent routes, permissions, restrictions or "authorization" requirements; only reference routes, fields and buttons in the provided context. If data is missing, say you do not know it.
- If truly ambiguous, ask ONE short question. Otherwise just do the action.`

function App() {
  return (
    <BrowserRouter>
      <AIGuideController />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/register"
          element={
            <ClientOnly>
              <Register />
            </ClientOnly>
          }
        />
        <Route path="/user_documentation" element={<UserDocumentation />} />
        <Route
          path="/developer_documentation"
          element={<DeveloperDocumentation />}
        />
        <Route path="/" element={<Layout />}>
          {APP_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
      </Routes>
      <CopilotPopup
        instructions={GUIDE_INSTRUCTIONS}
        labels={{
          title: 'Accounting Assistant',
          initial: 'Hi! I can help you navigate the accounting system. What would you like to do?',
        }}
      />
    </BrowserRouter>
  )
}

export default App