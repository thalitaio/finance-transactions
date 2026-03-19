import { useState } from 'react';
import { UsersPage } from './pages/UsersPage.tsx';
import { UserDetailPage } from './pages/UserDetailPage.tsx';
import { SummaryPage } from './pages/SummaryPage.tsx';
import { InvalidPage } from './pages/InvalidPage.tsx';
import { UploadPage } from './pages/UploadPage.tsx';

type Tab = 'users' | 'summary' | 'invalid' | 'upload';

export default function App() {
  const [tab, setTab] = useState<Tab>('upload');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  if (selectedUser) {
    return (
      <div className="app">
        <Header />
        <UserDetailPage
          userId={selectedUser}
          onBack={() => setSelectedUser(null)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <nav className="tabs">
        <button className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
          Upload
        </button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Users
        </button>
        <button className={`tab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button className={`tab ${tab === 'invalid' ? 'active' : ''}`} onClick={() => setTab('invalid')}>
          Invalid
        </button>
      </nav>

      {tab === 'upload' && <UploadPage />}
      {tab === 'users' && <UsersPage onSelectUser={setSelectedUser} />}
      {tab === 'summary' && <SummaryPage />}
      {tab === 'invalid' && <InvalidPage />}
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1>Inside Transactions</h1>
      <p>Financial transaction processor — upload, validate, and view processed data</p>
    </header>
  );
}
