import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">eTicket Bot Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Le bot Discord est actif et prêt à gérer vos tickets.
          </p>
          <div className="bg-muted p-4 rounded-md text-sm font-mono">
            Bot Status: En ligne
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
