"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/api";
import type { FriendshipStatusView } from "@/server/social/friendship";
import {
	acceptFriendRequestAction,
	cancelFriendRequestAction,
	declineFriendRequestAction,
	removeFriendAction,
	sendFriendRequestAction,
} from "@/server/social/friendship-actions";

type Props = { userId: string; status: FriendshipStatusView };

export function FriendButton({ userId, status }: Props) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const run = (action: (id: string) => Promise<ActionResult<unknown>>) =>
		startTransition(async () => {
			const result = await action(userId);
			setError("error" in result ? result.error.message : null);
		});

	const button = (
		label: string,
		action: (id: string) => Promise<ActionResult<unknown>>,
		primary = false,
	) => (
		<button
			type="button"
			disabled={pending}
			onClick={() => run(action)}
			className={
				primary
					? "rounded-full bg-forest px-4 py-2 text-sm font-bold text-paper disabled:opacity-60"
					: "rounded-full border border-forest px-4 py-2 text-sm font-bold text-forest disabled:opacity-60"
			}
		>
			{label}
		</button>
	);

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex gap-2">
				{status === "none" &&
					button("Adicionar amigo", sendFriendRequestAction, true)}
				{status === "sent" &&
					button("Cancelar pedido", cancelFriendRequestAction)}
				{status === "received" && (
					<>
						{button("Aceitar", acceptFriendRequestAction, true)}
						{button("Recusar", declineFriendRequestAction)}
					</>
				)}
				{status === "friends" && button("Desfazer amizade", removeFriendAction)}
			</div>
			{error && (
				<p role="alert" className="text-sm text-clay">
					{error}
				</p>
			)}
		</div>
	);
}
