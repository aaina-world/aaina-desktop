import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "../components/Toast";
import type { ShootKind } from "../../lib/contract";

export const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/** Opens the Create flow with product photos already chosen (dropped on the window or picked on Home). */
export function useStartShoot() {
  const navigate = useNavigate();
  return useCallback(
    (paths: string[], kind?: ShootKind) => {
      const files = paths.filter((p) => IMAGE_EXT.test(p) || p.startsWith("blob:")).slice(0, 6);
      if (!files.length) {
        toast("Those files aren't JPG, PNG or WebP photos.", { icon: "alert" });
        return;
      }
      void navigate("/create/new", { state: { paths: files, kind } });
    },
    [navigate],
  );
}
