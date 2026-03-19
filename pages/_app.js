import '../styles/globals.css';
import { AuthProvider } from '../components/AuthContext';
import Footer from '../components/Footer';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
      <Footer />
    </AuthProvider>
  );
}
