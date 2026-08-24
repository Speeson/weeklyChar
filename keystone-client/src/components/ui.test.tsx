import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge, Button, Card, Dialog, IconButton, SelectField, StatusRow, TextField, Tooltip } from "./ui";

describe("design system primitives", () => {
  it("renders command controls with icons and accessible names", () => {
    render(
      <div>
        <Button icon={<Search aria-hidden="true" size={16} />}>Buscar</Button>
        <IconButton icon={<Search aria-hidden="true" size={16} />} label="Buscar rapido" />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar rapido" })).toHaveAttribute("title", "Buscar rapido");
  });

  it("renders fields, cards, badges, status rows, dialog, and tooltip", () => {
    render(
      <Card>
        <Badge tone="success">Activo</Badge>
        <TextField label="Usuario" />
        <SelectField label="Idioma">
          <option value="es">Espanol</option>
        </SelectField>
        <dl>
          <StatusRow label="Estado" tone="warning" value="Pendiente" />
        </dl>
        <Tooltip label="Mas detalle">
          <span>?</span>
        </Tooltip>
        <Dialog open title="Confirmar">
          <p>Contenido</p>
        </Dialog>
      </Card>,
    );

    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByText("?").closest(".ui-tooltip")).toHaveAttribute("data-tooltip", "Mas detalle");
  });
});
