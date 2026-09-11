// Create Account is now just Sign In's shared shell opened in "create" mode —
// see SignIn.jsx for why: the real sliding transition between the two only
// works if they're the same mounted component internally toggling state,
// not two separate pages. This wrapper exists purely so every existing
// `import { CreateAccount } from './pages/CreateAccount.jsx'` /
// `nav('create', job)` call site keeps working unchanged.
import { SignIn } from './SignIn.jsx';

export function CreateAccount(props) {
  return <SignIn {...props} initialMode="create" />;
}
export default CreateAccount;
