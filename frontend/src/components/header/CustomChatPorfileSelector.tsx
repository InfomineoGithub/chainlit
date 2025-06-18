import { Check, ChevronDown } from 'lucide-react';
import { Dispatch, SetStateAction, useContext, useEffect } from 'react';

import {
  ChainlitContext,
  ChatProfile,
  useConfig
} from '@chainlit/react-client';

import { Markdown } from '@/components/Markdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  selectedChatProfile: string | undefined;
  setSelectedChatProfile: Dispatch<SetStateAction<string | undefined>>;
}

type ChatProfileMenuItem =
  | ChatProfile
  | { name: string; chatProfiles: ChatProfile[] };

export default function CustomChatProfileSelector({
  selectedChatProfile,
  setSelectedChatProfile
}: Props) {
  const apiClient = useContext(ChainlitContext);
  const { config } = useConfig();
  // Early return check to prevent unnecessary renders and resource waste
  if (!config?.chatProfiles?.length || config.chatProfiles.length <= 1) {
    return null;
  }

  // Handle case when no profile is selected
  useEffect(() => {
    if (!selectedChatProfile) {
      setSelectedChatProfile(config.chatProfiles[0].name);
    }
  }, [selectedChatProfile, config.chatProfiles, setSelectedChatProfile]);

  // Handle case when selected profile becomes invalid
  useEffect(() => {
    if (selectedChatProfile) {
      const profileExists = config.chatProfiles.some(
        (profile) => profile.name === selectedChatProfile
      );
      if (!profileExists) {
        setSelectedChatProfile(config.chatProfiles[0].name);
      }
    }
  }, [selectedChatProfile, config.chatProfiles, setSelectedChatProfile]);

  const allowHtml = config?.features?.unsafe_allow_html;
  const latex = config?.features?.latex;

  // Resolve icons for chat profiles
  // If the icon path includes '/public', it is resolved using the apiClient
  const resolved_icons = config.chatProfiles.reduce((final, current) => {
    const icon = current.icon?.includes('/public')
      ? apiClient.buildEndpoint(current.icon)
      : current.icon;
    return {
      ...final,
      [current.name]: icon
    };
  }, {} as Record<string, string | undefined>);

  // Prepare the chat profile menu items, building profile groups
  const chatProfileMenu: ChatProfileMenuItem[] = [];
  const chatProfileGroups: Record<
    string,
    { name: string; chatProfiles: ChatProfile[] }
  > = {};
  for (const profile of config.chatProfiles) {
    if (!profile.group) {
      chatProfileMenu.push(profile);
    } else {
      if (!chatProfileGroups[profile.group]) {
        chatProfileGroups[profile.group] = {
          name: profile.group,
          chatProfiles: []
        };
        chatProfileMenu.push(chatProfileGroups[profile.group]);
      }
      chatProfileGroups[profile.group].chatProfiles.push(profile);
    }
  }

  return (
    <DropdownMenu modal={true}>
      <DropdownMenuTrigger
        id="chat-profiles"
        className="flex h-10 items-center justify-between rounded-md border border-input px-2 py-2 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-full border-none bg-transparent text-muted-foreground font-semibold text-sm hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          {selectedChatProfile && resolved_icons[selectedChatProfile] && (
            <img
              src={resolved_icons[selectedChatProfile]}
              alt={selectedChatProfile}
              className="w-6 h-6 rounded-md object-cover shrink-0"
            />
          )}
          <span className="truncate max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis block">
            {selectedChatProfile ?? 'Select profile ... '}
          </span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <ScrollArea className="max-h-[72] rounded-md">
          {chatProfileMenu.map((item) =>
            'chatProfiles' in item ? (
              <ChatProfileGroup
                key={item.name}
                group={item}
                selectedChatProfile={selectedChatProfile}
                setSelectedChatProfile={setSelectedChatProfile}
                resolved_icons={resolved_icons}
                allowHtml={allowHtml}
                latex={latex}
              />
            ) : (
              <ChatProfileDropdownMenuItem
                key={item.name}
                profile={item}
                selectedChatProfile={selectedChatProfile}
                setSelectedChatProfile={setSelectedChatProfile}
                icon={resolved_icons[item.name]}
                allowHtml={allowHtml}
                latex={latex}
              />
            )
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ChatProfileDropdownMenuItemProps {
  profile: ChatProfile;
  selectedChatProfile: string | undefined;
  setSelectedChatProfile: Dispatch<SetStateAction<string | undefined>>;
  icon?: string;
  allowHtml?: boolean;
  latex?: boolean;
}

function ChatProfileDropdownMenuItem({
  profile,
  selectedChatProfile,
  setSelectedChatProfile,
  icon,
  allowHtml,
  latex
}: Readonly<ChatProfileDropdownMenuItemProps>) {
  return (
    <HoverCard openDelay={0} closeDelay={0} key={profile.name}>
      <HoverCardTrigger asChild>
        <DropdownMenuItem
          data-test={`select-item:${profile.name}`}
          onSelect={() => setSelectedChatProfile(profile.name)}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {profile.name === selectedChatProfile ? (
              <Check />
            ) : (
              <span style={{ width: 15, display: 'inline-block' }} />
            )}
            {icon && (
              <img
                src={icon}
                alt={profile.name}
                className="w-6 h-6 rounded-md object-cover shrink-0"
              />
            )}
            <span className="truncate max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis block">
              {profile.name}
            </span>
          </div>
        </DropdownMenuItem>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        id="chat-profile-description"
        align="start"
        className="w-80 overflow-visible hidden sm:block"
        sideOffset={10}
      >
        <Markdown allowHtml={allowHtml} latex={latex}>
          {profile.markdown_description}
        </Markdown>
      </HoverCardContent>
    </HoverCard>
  );
}

interface ChatProfileGroupProps {
  group: { name: string; chatProfiles: ChatProfile[] };
  selectedChatProfile: string | undefined;
  setSelectedChatProfile: Dispatch<SetStateAction<string | undefined>>;
  resolved_icons: Record<string, string | undefined>;
  allowHtml?: boolean;
  latex?: boolean;
}

function ChatProfileGroup({
  group,
  selectedChatProfile,
  setSelectedChatProfile,
  resolved_icons,
  allowHtml,
  latex
}: Readonly<ChatProfileGroupProps>) {
  return (
    <DropdownMenuSub key={group.name}>
      <DropdownMenuSubTrigger>
        <div className="flex items-center gap-2">
          <span style={{ width: 15, display: 'inline-block' }} />
          <span className="truncate max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis block">
            {group.name}
          </span>
        </div>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {group.chatProfiles.map((profile) => (
            <ChatProfileDropdownMenuItem
              key={profile.name}
              profile={profile}
              selectedChatProfile={selectedChatProfile}
              setSelectedChatProfile={setSelectedChatProfile}
              icon={resolved_icons[profile.name]}
              allowHtml={allowHtml}
              latex={latex}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
