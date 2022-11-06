import React, { useCallback, useEffect, useRef, useState } from 'react';
import copy from 'copy-text-to-clipboard';
import Tooltip from '../Tooltip';

export default function CopyButton ({ children, buttonClassName, text, tooltipClassName }) {
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeout = useRef(undefined);

  const handleCopy = useCallback(() => {
    copy(text);
    setIsCopied(true);
    copyTimeout.current = window.setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  }, [text]);

  useEffect(() => () => window.clearTimeout(copyTimeout.current), []);

  return (
    <Tooltip text={isCopied ? `Copied!` : `Copy to Clipboard`} tooltipClassName={tooltipClassName}>
      <button className={`copy-action ${buttonClassName}`} onClick={handleCopy}>
        {children}
      </button>
    </Tooltip>
  )
}