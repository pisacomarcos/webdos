import { PropsWithChildren } from "react"

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  //   const { user, isLoading } = useAdminGetSession()
  //   const navigate = useNavigate()

  //   useEffect(() => {
  //     if (!user && !isLoading) {
  //       navigate("/login")
  //     }
  //   }, [user, isLoading])

  //   if (isLoading) {
  //     return <div>Loading...</div>
  //   }

  return <>{children}</>
}
