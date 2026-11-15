import { DesktopShell } from '../../components/desktop/shell';
import './desktop.css';
export default function Layout({ children }: { children: React.ReactNode }) { return <DesktopShell>{children}</DesktopShell>; }
