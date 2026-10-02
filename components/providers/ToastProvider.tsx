'use client';

import { ToastContainer } from 'react-toastify';

export default function ToastProvider() {
  return (
    <ToastContainer
      position="bottom-center"
      autoClose={3200}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      theme="light"
      limit={3}
      toastClassName="hub-toast"
    />
  );
}
