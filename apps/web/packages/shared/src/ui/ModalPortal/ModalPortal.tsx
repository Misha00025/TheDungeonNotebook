import React from 'react';
import { createPortal } from 'react-dom';
import modalStyles from '../../styles/modal.module.css';

interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default ModalPortal;
