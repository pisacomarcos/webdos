import React from "react"
import { IconProps } from ".."

const IconServerStack: React.FC<IconProps> = ({
  iconColorClassName,
  ...props
}) => {
  return (
    <svg
      width={props.width || 20}
      height={props.height || 20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4.375 11.875H15.625M4.375 11.875C3.71196 11.875 3.07607 11.6116 2.60723 11.1428C2.13839 10.6739 1.875 10.038 1.875 9.375M4.375 11.875C3.71196 11.875 3.07607 12.1384 2.60723 12.6072C2.13839 13.0761 1.875 13.712 1.875 14.375C1.875 15.038 2.13839 15.6739 2.60723 16.1428C3.07607 16.6116 3.71196 16.875 4.375 16.875H15.625C16.288 16.875 16.9239 16.6116 17.3928 16.1428C17.8616 15.6739 18.125 15.038 18.125 14.375C18.125 13.712 17.8616 13.0761 17.3928 12.6072C16.9239 12.1384 16.288 11.875 15.625 11.875M1.875 9.375C1.875 8.71196 2.13839 8.07607 2.60723 7.60723C3.07607 7.13839 3.71196 6.875 4.375 6.875H15.625C16.288 6.875 16.9239 7.13839 17.3928 7.60723C17.8616 8.07607 18.125 8.71196 18.125 9.375M1.875 9.375C1.875 8.56361 2.13817 7.77411 2.625 7.125L4.78083 4.25C5.04281 3.9007 5.38251 3.61719 5.77305 3.42192C6.16358 3.22666 6.59421 3.125 7.03083 3.125H12.9692C13.8542 3.125 14.6875 3.54167 15.2192 4.25L17.375 7.125C17.8618 7.77411 18.125 8.56361 18.125 9.375M18.125 9.375C18.125 10.038 17.8616 10.6739 17.3928 11.1428C16.9239 11.6116 16.288 11.875 15.625 11.875M15.625 14.375H15.6317V14.3817H15.625V14.375ZM15.625 9.375H15.6317V9.38167H15.625V9.375ZM13.125 14.375H13.1317V14.3817H13.125V14.375ZM13.125 9.375H13.1317V9.38167H13.125V9.375Z"
        className={
          iconColorClassName ||
          "stroke-medusa-fg-subtle dark:stroke-medusa-fg-subtle-dark"
        }
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default IconServerStack
